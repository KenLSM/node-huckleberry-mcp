import { describe, it, expect } from "vitest";
import { HuckleberryClient } from "../client/HuckleberryClient.js";
import {
  getDefaultChildUid,
  logSleep,
  getSleepHistory,
  logNursing,
  logBottle,
  logSolids,
  getFeedHistory,
  logPump,
  listPumpIntervals,
  logDiaper,
  logPotty,
  getDiaperHistory,
  logGrowth,
  getGrowthHistory,
} from "../client/index.js";

/**
 * T3.2 — Live WRITE round-trip suite. For each tracker it logs a real entry,
 * reads it back to prove the write landed in Firestore, then deletes it to
 * exercise the delete path. Unlike the read-only `live.integration.test.ts`,
 * this MUTATES the account, so it is double-gated:
 *
 *   - HUCKLEBERRY_EMAIL + HUCKLEBERRY_PASSWORD must be set (as for all live tests), and
 *   - HUCKLEBERRY_ALLOW_WRITES=1 must be set as an explicit opt-in.
 *
 * Run against a TEST account only:
 *
 *   HUCKLEBERRY_EMAIL=… HUCKLEBERRY_PASSWORD=… HUCKLEBERRY_ALLOW_WRITES=1 \
 *     npm run test:integration
 *
 * Each `log*` op returns the new doc id, so cleanup is deterministic via
 * client.deleteDoc(...). If an assertion fails mid-test the entry is still
 * deleted in `finally`. Note: the write also bumps the parent `prefs.last*`
 * summary; that is left as-is (harmless, just reflects the most recent entry).
 */
const email = process.env.HUCKLEBERRY_EMAIL;
const password = process.env.HUCKLEBERRY_PASSWORD;
const allowWrites = process.env.HUCKLEBERRY_ALLOW_WRITES === "1";
const enabled = Boolean(email && password) && allowWrites;

// Distinct, slightly-in-the-past epoch seconds per call so each test's entry is
// uniquely identifiable by `start` even when several run within the same second.
let seq = 0;
function uniqueStart(): number {
  return Math.floor(Date.now() / 1000) - seq++ * 1000;
}

function makeClient(): HuckleberryClient {
  return new HuckleberryClient({ credentials: { email: email!, password: password! } });
}

/**
 * write → read-back (assert present) → delete → read-back (assert gone).
 * `readStarts` returns the `start` values currently in the tracker; the entry is
 * matched by its unique `start`. `deleteSegments` builds the doc path to delete.
 */
async function roundTrip(
  write: (client: HuckleberryClient, cid: string) => Promise<string>,
  readStarts: (client: HuckleberryClient, cid: string) => Promise<number[]>,
  deleteSegments: (cid: string, id: string) => [string, ...string[]],
  expectedStart: number,
): Promise<void> {
  const client = makeClient();
  try {
    const cid = await getDefaultChildUid(client);
    const id = await write(client, cid);
    let cleaned = false;
    try {
      const before = await readStarts(client, cid);
      expect(before).toContain(expectedStart);

      const [path, ...segments] = deleteSegments(cid, id);
      await client.deleteDoc(path, ...segments);
      cleaned = true;

      const after = await readStarts(client, cid);
      expect(after).not.toContain(expectedStart);
    } finally {
      if (!cleaned) {
        const [path, ...segments] = deleteSegments(cid, id);
        await client.deleteDoc(path, ...segments).catch(() => undefined);
      }
    }
  } finally {
    await client.signOut();
  }
}

describe.skipIf(!enabled)("live write round-trip (log_* + delete)", () => {
  it("log_sleep writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) =>
        logSleep(client, cid, new Date((start - 3600) * 1000), new Date(start * 1000)),
      async (client, cid) =>
        (await getSleepHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["sleep", cid, "intervals", id],
      start,
    );
  });

  it("log_nursing writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) =>
        logNursing(client, cid, { start, leftDuration: 300, rightDuration: 300, lastSide: "left" }),
      async (client, cid) => (await getFeedHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
    );
  });

  it("log_bottle writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) =>
        logBottle(client, cid, {
          start,
          amount: 120,
          bottleType: "Formula",
          units: "ml",
          notes: "live write round-trip test",
        }),
      async (client, cid) => (await getFeedHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
    );
  });

  it("log_solids writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) => logSolids(client, cid, { start }),
      async (client, cid) => (await getFeedHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
    );
  });

  it("log_pump writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) =>
        logPump(client, cid, {
          start,
          leftAmount: 60,
          rightAmount: 60,
          units: "ml",
          duration: 600,
        }),
      async (client, cid) =>
        (await listPumpIntervals(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["pump", cid, "intervals", id],
      start,
    );
  });

  it("log_diaper writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) =>
        logDiaper(client, cid, {
          mode: "both",
          start,
          peeAmount: "little",
          pooAmount: "medium",
          color: "yellow",
        }),
      async (client, cid) =>
        (await getDiaperHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["diaper", cid, "intervals", id],
      start,
    );
  });

  it("log_potty writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) => logPotty(client, cid, { mode: "pee", start }),
      async (client, cid) =>
        (await getDiaperHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["diaper", cid, "intervals", id],
      start,
    );
  });

  it("log_growth writes, reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    await roundTrip(
      (client, cid) =>
        logGrowth(client, cid, { weight: 5.5, units: "metric", time: new Date(start * 1000) }),
      async (client, cid) =>
        (await getGrowthHistory(client, cid, { limit: 50 })).map((i) => i.start),
      (cid, id) => ["health", cid, "data", id],
      start,
    );
  });
});
