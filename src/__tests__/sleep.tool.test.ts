import { describe, it, expect, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

// Mock Firestore so we can assert the exact document written, and mock the
// server's auth module so `log_sleep`'s handler gets our fake client instead
// of trying to authenticate for real.
const { mockAddDoc, mockSetDoc, mockCollection, mockDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "sleep-id" })),
  mockSetDoc: vi.fn(async () => undefined),
  mockCollection: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
  mockDoc: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDocs: vi.fn(),
  query: (col: unknown) => col,
  orderBy: () => ({}),
  limit: () => ({}),
}));

const OFFSET = 0;
const fakeClient = {
  connect: vi.fn(async () => ({})),
  getFirestore: () => ({}),
  getOffsetMinutes: () => OFFSET,
} as unknown as HuckleberryClient;

vi.mock("../server/auth.js", () => ({
  getClient: vi.fn(() => fakeClient),
}));

import { createServer } from "../server/server.js";
import "../tools/sleep.js";

async function connectedClient(): Promise<Client> {
  const server = createServer();
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
}

function lastInterval() {
  return mockAddDoc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => vi.clearAllMocks());

describe("log_sleep tool (BUG1 regression)", () => {
  it("converts a seconds-based start/end window into the correct duration", async () => {
    const client = await connectedClient();
    // A 30-minute window expressed as the documented epoch-seconds convention
    // (matching README/SKILL.md), the same way every other log_* tool takes
    // start/end. Before the fix, log_sleep's schema/handler treated these as
    // milliseconds and divided the (unconverted) gap by 1000, collapsing any
    // real window down to a fraction of a second.
    const start = 1_700_000_000;
    const end = start + 1800;

    const result = await client.callTool({
      name: "log_sleep",
      arguments: { child_uid: "cid", start, end },
    });

    expect(result.isError).not.toBe(true);
    expect(lastInterval()).toMatchObject({ start, duration: 1800, offset: OFFSET });
  });

  it("rejects the old millisecond-style start_time/end_time fields", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "log_sleep",
      arguments: { child_uid: "cid", start_time: 1_700_000_000_000, end_time: 1_700_001_800_000 },
    });
    expect(result.isError).toBe(true);
  });
});
