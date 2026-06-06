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
 * T3.2 — Live WRITE round-trip suite. For each tracker it logs a real entry
 * (with a unique `notes`), reads it back to prove the write landed in Firestore
 * AND that `notes` round-trips, then deletes it to exercise the delete path.
 * Unlike the read-only `live.integration.test.ts`, this MUTATES the account, so
 * it is double-gated:
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

/** An entry as surfaced by the read/history ops, narrowed to what we assert on. */
type ReadEntry = { start: number; notes?: string };

/**
 * write → read-back (assert present + notes) → delete → read-back (assert gone).
 * The entry is matched by its unique `start`. `readEntries` returns the current
 * tracker entries; `deleteSegments` builds the doc path to delete.
 */
async function roundTrip(
  write: (client: HuckleberryClient, cid: string) => Promise<string>,
  readEntries: (client: HuckleberryClient, cid: string) => Promise<ReadEntry[]>,
  deleteSegments: (cid: string, id: string) => [string, ...string[]],
  expectedStart: number,
  expectedNotes: string,
): Promise<void> {
  const client = makeClient();
  try {
    const cid = await getDefaultChildUid(client);
    const id = await write(client, cid);
    let cleaned = false;
    try {
      const before = await readEntries(client, cid);
      const entry = before.find((e) => e.start === expectedStart);
      expect(entry, `entry with start=${expectedStart} should have been written`).toBeDefined();
      expect(entry?.notes).toBe(expectedNotes);

      const [path, ...segments] = deleteSegments(cid, id);
      await client.deleteDoc(path, ...segments);
      cleaned = true;

      const after = await readEntries(client, cid);
      expect(after.find((e) => e.start === expectedStart)).toBeUndefined();
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
  it("log_sleep writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    // logSleep stores the sleep START (startDate), not the end — match on that.
    const end = uniqueStart();
    const sleepStart = end - 3600;
    const notes = "sleep round-trip note";
    await roundTrip(
      (client, cid) =>
        logSleep(client, cid, new Date(sleepStart * 1000), new Date(end * 1000), { notes }),
      async (client, cid) => getSleepHistory(client, cid, { limit: 50 }),
      (cid, id) => ["sleep", cid, "intervals", id],
      sleepStart,
      notes,
    );
  });

  it("log_nursing writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "nursing round-trip note";
    await roundTrip(
      (client, cid) =>
        logNursing(client, cid, {
          start,
          leftDuration: 300,
          rightDuration: 300,
          lastSide: "left",
          notes,
        }),
      async (client, cid) => getFeedHistory(client, cid, { limit: 50 }),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
      notes,
    );
  });

  it("log_bottle writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "bottle round-trip note";
    await roundTrip(
      (client, cid) =>
        logBottle(client, cid, { start, amount: 120, bottleType: "Formula", units: "ml", notes }),
      async (client, cid) => getFeedHistory(client, cid, { limit: 50 }),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
      notes,
    );
  });

  it("log_solids writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "solids round-trip note";
    await roundTrip(
      (client, cid) => logSolids(client, cid, { start, notes }),
      async (client, cid) => getFeedHistory(client, cid, { limit: 50 }),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
      notes,
    );
  });

  it("log_pump writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "pump round-trip note";
    await roundTrip(
      (client, cid) =>
        logPump(client, cid, {
          start,
          leftAmount: 60,
          rightAmount: 60,
          units: "ml",
          duration: 600,
          notes,
        }),
      async (client, cid) => listPumpIntervals(client, cid, { limit: 50 }),
      (cid, id) => ["pump", cid, "intervals", id],
      start,
      notes,
    );
  });

  it("log_diaper writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "diaper round-trip note";
    await roundTrip(
      (client, cid) =>
        logDiaper(client, cid, {
          mode: "both",
          start,
          peeAmount: "little",
          pooAmount: "medium",
          color: "yellow",
          notes,
        }),
      async (client, cid) => getDiaperHistory(client, cid, { limit: 50 }),
      (cid, id) => ["diaper", cid, "intervals", id],
      start,
      notes,
    );
  });

  it("log_potty writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "potty round-trip note";
    await roundTrip(
      (client, cid) => logPotty(client, cid, { mode: "pee", start, notes }),
      async (client, cid) => getDiaperHistory(client, cid, { limit: 50 }),
      (cid, id) => ["diaper", cid, "intervals", id],
      start,
      notes,
    );
  });

  it("log_growth writes (with notes), reads back, and deletes", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "growth round-trip note";
    await roundTrip(
      (client, cid) =>
        logGrowth(client, cid, {
          weight: 5.5,
          units: "metric",
          time: new Date(start * 1000),
          notes,
        }),
      async (client, cid) => getGrowthHistory(client, cid, { limit: 50 }),
      (cid, id) => ["health", cid, "data", id],
      start,
      notes,
    );
  });
});
