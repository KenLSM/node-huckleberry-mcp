import { describe, it, expect } from "vitest";
import { HuckleberryClient } from "../client/HuckleberryClient.js";
import { getUser, getChildren } from "../client/childOps.js";

/**
 * T3.2 — Live integration suite. Runs against a REAL Huckleberry account and is
 * skipped unless HUCKLEBERRY_EMAIL and HUCKLEBERRY_PASSWORD are set, so CI (which
 * has no credentials) skips it by default.
 *
 *   HUCKLEBERRY_EMAIL=… HUCKLEBERRY_PASSWORD=… npm run test:integration
 *
 * These are read-only. Write-path round-trips will be added per tracker as the
 * client ops are ported to the real schema (see docs/integration-testing.md).
 */
const email = process.env.HUCKLEBERRY_EMAIL;
const password = process.env.HUCKLEBERRY_PASSWORD;
const hasCreds = Boolean(email && password);

describe.skipIf(!hasCreds)("live integration (real account)", () => {
  function makeClient(): HuckleberryClient {
    return new HuckleberryClient({ credentials: { email: email!, password: password! } });
  }

  it(
    "authenticates and reads the user document with a child list",
    { timeout: 20000 },
    async () => {
      const client = makeClient();
      try {
        const { user, childUids } = await getUser(client);
        expect(user).toBeTruthy();
        expect(Array.isArray(childUids)).toBe(true);
      } finally {
        await client.signOut();
      }
    },
  );

  it("reads child profiles for the account", { timeout: 20000 }, async () => {
    const client = makeClient();
    try {
      const children = await getChildren(client);
      expect(Array.isArray(children)).toBe(true);
    } finally {
      await client.signOut();
    }
  });
});
