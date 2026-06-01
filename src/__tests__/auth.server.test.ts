import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock HuckleberryClient before importing the module under test
const { MockClient } = vi.hoisted(() => {
  class MockClient {
    credentials: unknown;
    constructor(opts: { credentials: unknown }) {
      this.credentials = opts.credentials;
    }
  }
  return { MockClient };
});

vi.mock("../client/HuckleberryClient.js", () => ({
  HuckleberryClient: MockClient,
}));

import { getClient, _resetClient } from "../server/auth";

describe("getClient() — T2.2 lazy auth", () => {
  beforeEach(() => {
    _resetClient();
    vi.unstubAllEnvs();
  });

  it("throws a clear error when credentials are missing", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "");
    expect(() => getClient()).toThrow("Missing credentials");
  });

  it("throws when only email is set", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "user@example.com");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "");
    expect(() => getClient()).toThrow("Missing credentials");
  });

  it("throws when only password is set", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "secret");
    expect(() => getClient()).toThrow("Missing credentials");
  });

  it("returns a HuckleberryClient when both credentials are set", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "user@example.com");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "secret");
    const client = getClient();
    expect(client).toBeInstanceOf(MockClient);
  });

  it("passes credentials from env to the client", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "test@test.com");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "mypassword");
    const client = getClient() as InstanceType<typeof MockClient>;
    expect((client.credentials as { email: string }).email).toBe("test@test.com");
    expect((client.credentials as { password: string }).password).toBe("mypassword");
  });

  it("returns the same client instance on repeated calls", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "user@example.com");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "secret");
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
  });

  it("creates a new client after _resetClient()", () => {
    vi.stubEnv("HUCKLEBERRY_EMAIL", "user@example.com");
    vi.stubEnv("HUCKLEBERRY_PASSWORD", "secret");
    const a = getClient();
    _resetClient();
    const b = getClient();
    expect(a).not.toBe(b);
  });
});
