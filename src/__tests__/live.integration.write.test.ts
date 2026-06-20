import { describe, it, expect } from "vitest";
import { HuckleberryClient } from "../client/HuckleberryClient.js";
import {
  getDefaultChildUid,
  logSleep,
  getSleepHistory,
  editSleep,
  logNursing,
  logBottle,
  logSolids,
  getFeedHistory,
  editFeed,
  logPump,
  listPumpIntervals,
  editPump,
  logDiaper,
  logPotty,
  getDiaperHistory,
  editDiaper,
  logGrowth,
  getGrowthHistory,
  editGrowth,
  createCustomFood,
  listCustomFoods,
} from "../client/index.js";

/**
 * T3.2 — Live WRITE round-trip suite. For each tracker it logs a real entry
 * (with a unique `notes`), reads it back to prove the write landed in Firestore
 * AND that `notes` round-trips, then edits the note via the tracker's `edit_*`
 * op and reads it back again to prove the edit landed, then deletes it to
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
 * deleted in `finally`. Note: writes also bump the parent `prefs.last*` summary;
 * that is left as-is (harmless, just reflects the most recent entry).
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

/** An optional edit step: mutate the entry, then assert the new notes value. */
interface EditStep {
  run: (client: HuckleberryClient, cid: string, id: string) => Promise<void>;
  expectedNotes: string;
}

/**
 * write → read-back (present + notes) → [edit → read-back (new notes)] →
 * delete → read-back (gone). The entry is matched by its unique `start`, which
 * the edit step must not change. `deleteSegments` builds the doc path to delete.
 */
async function roundTrip(
  write: (client: HuckleberryClient, cid: string) => Promise<string>,
  readEntries: (client: HuckleberryClient, cid: string) => Promise<ReadEntry[]>,
  deleteSegments: (cid: string, id: string) => [string, ...string[]],
  expectedStart: number,
  expectedNotes: string,
  edit: EditStep,
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

      await edit.run(client, cid, id);
      const afterEdit = await readEntries(client, cid);
      const edited = afterEdit.find((e) => e.start === expectedStart);
      expect(edited?.notes, "edit_* should have updated notes").toBe(edit.expectedNotes);

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

describe.skipIf(!enabled)("live write round-trip (log_* + edit_* + delete)", () => {
  it("sleep: log, read, edit_sleep, delete", { timeout: 30000 }, async () => {
    // logSleep stores the sleep START (startDate), not the end — match on that.
    const end = uniqueStart();
    const sleepStart = end - 3600;
    const notes = "sleep round-trip note";
    const edited = `${notes} (edited)`;
    await roundTrip(
      (client, cid) =>
        logSleep(client, cid, new Date(sleepStart * 1000), new Date(end * 1000), { notes }),
      async (client, cid) => getSleepHistory(client, cid, { limit: 50 }),
      (cid, id) => ["sleep", cid, "intervals", id],
      sleepStart,
      notes,
      {
        run: (client, cid, id) => editSleep(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("nursing: log, read, edit_feed, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "nursing round-trip note";
    const edited = `${notes} (edited)`;
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
      {
        run: (client, cid, id) => editFeed(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("bottle: log, read, edit_feed, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "bottle round-trip note";
    const edited = `${notes} (edited)`;
    await roundTrip(
      (client, cid) =>
        logBottle(client, cid, { start, amount: 120, bottleType: "Formula", units: "ml", notes }),
      async (client, cid) => getFeedHistory(client, cid, { limit: 50 }),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
      notes,
      {
        run: (client, cid, id) => editFeed(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("solids: log, read, edit_feed, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "solids round-trip note";
    const edited = `${notes} (edited)`;
    await roundTrip(
      (client, cid) => logSolids(client, cid, { start, notes }),
      async (client, cid) => getFeedHistory(client, cid, { limit: 50 }),
      (cid, id) => ["feed", cid, "intervals", id],
      start,
      notes,
      {
        run: (client, cid, id) => editFeed(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("pump: log, read, edit_pump, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "pump round-trip note";
    const edited = `${notes} (edited)`;
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
      {
        run: (client, cid, id) => editPump(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("diaper: log, read, edit_diaper, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "diaper round-trip note";
    const edited = `${notes} (edited)`;
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
      {
        run: (client, cid, id) => editDiaper(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("potty: log, read, edit_diaper, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "potty round-trip note";
    const edited = `${notes} (edited)`;
    await roundTrip(
      (client, cid) => logPotty(client, cid, { mode: "pee", start, notes }),
      async (client, cid) => getDiaperHistory(client, cid, { limit: 50 }),
      (cid, id) => ["diaper", cid, "intervals", id],
      start,
      notes,
      {
        run: (client, cid, id) => editDiaper(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  it("growth: log, read, edit_growth, delete", { timeout: 30000 }, async () => {
    const start = uniqueStart();
    const notes = "growth round-trip note";
    const edited = `${notes} (edited)`;
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
      {
        run: (client, cid, id) => editGrowth(client, cid, id, { notes: edited }),
        expectedNotes: edited,
      },
    );
  });

  // B5: solids meal content (foods + reaction). Shapes are ported from the Python
  // API and not yet app-confirmed — this proves Firestore accepts + returns them.
  it("solids with foods + reaction round-trips", { timeout: 30000 }, async () => {
    const client = makeClient();
    try {
      const cid = await getDefaultChildUid(client);
      const start = uniqueStart();
      const id = await logSolids(client, cid, {
        start,
        foods: [{ id: "test-food", name: "Test Food", source: "curated", amount: "a little" }],
        reaction: "LOVED",
        notes: "solids+foods round-trip",
      });
      try {
        const items = await getFeedHistory(client, cid, { limit: 50 });
        const entry = items.find((e) => e.start === start) as
          | {
              foods?: Record<string, { created_name?: string }>;
              reactions?: Record<string, boolean>;
            }
          | undefined;
        expect(entry, "solids entry should have been written").toBeDefined();
        expect(entry?.foods?.["test-food"]?.created_name).toBe("Test Food");
        expect(entry?.reactions?.LOVED).toBe(true);
      } finally {
        await client.deleteDoc("feed", cid, "intervals", id).catch(() => undefined);
      }
    } finally {
      await client.signOut();
    }
  });

  // B5: custom food create → list → delete. Custom-food write shape is ported
  // from the Python API and not yet app-confirmed.
  it("custom food: create, list, delete", { timeout: 30000 }, async () => {
    const client = makeClient();
    try {
      const cid = await getDefaultChildUid(client);
      const name = `RT custom food ${Date.now()}`;
      const id = await createCustomFood(client, cid, name);
      try {
        const foods = await listCustomFoods(client, cid);
        const food = foods.find((f) => f.id === id);
        expect(food, "created custom food should be listed").toBeDefined();
        expect(food?.name).toBe(name);
        expect(food?.type).toBe("solids");
      } finally {
        await client.deleteDoc("types", cid, "custom", id).catch(() => undefined);
      }
    } finally {
      await client.signOut();
    }
  });
});
