# Schema Port Spec — build to this exactly

**Audience:** implementer models (Haiku/Sonnet). This is an unambiguous spec for
reworking the client models + write ops (T1.3, T1.5–T1.9) to the **real**
Huckleberry Firestore schema. Do not invent fields or paths. If something here is
underspecified, STOP and ask — do not guess.

**Ground truth:** `docs/architecture.md` → "Verified Firestore tracker schema"
(captured live via `npm run inspect:schema`). Re-run that workflow if you need
more samples.

**Gates (all must stay green):** `npm run build`, `npm run lint`,
`npm run format:check`, `npm test`.

---

## 0. Universal conventions (apply to every tracker)

1. **No Firestore `Timestamp` objects.** All time values are plain JS numbers:
   - `start` = event time in **epoch seconds** = `eventDate.getTime() / 1000`.
   - `lastUpdated` = now in epoch seconds = `Date.now() / 1000`.
   - `duration` = **seconds** (number).
   - `offset` = `client.getOffsetMinutes(eventDate)` (already implemented; UTC+8 → −480).
2. **Remove all invented fields** from current ops/models: `startTime`, `endTime`,
   `status`, `pauseTime`, `date`, `cid`, `note(s)`, `createdAt`, `updatedAt`,
   `weightUnit`, `*Unit`, `headCircumference`. They do not exist in the real schema.
3. **Doc IDs:** use `addDoc` (Firestore auto-IDs). Do not synthesize IDs.
4. **Every write does TWO things** (see helper below): write the interval doc,
   then merge-update the parent `prefs` summary.
5. **Reads:** `query(col, orderBy("start", "desc"), limit(n))`, default `n = 50`.
6. Drop unused `firebase/firestore` imports (e.g. `Timestamp`) to keep lint green.

### 0.1 Shared write helper (implement once, in `src/client/prefs.ts`)

```ts
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";

/**
 * Writes an interval document to `{collectionName}/{childUid}/{subcollection}`
 * and merge-updates the parent doc's prefs summary, matching the Huckleberry app.
 * Returns the new interval doc id.
 */
export async function writeIntervalWithPrefs(
  client: HuckleberryClient,
  opts: {
    collectionName: string; // "sleep" | "feed" | "diaper" | "pump"
    subcollection: string; // "intervals"
    childUid: string;
    interval: Record<string, unknown>; // the interval body (already built)
    prefs: Record<string, unknown>; // prefs fields to merge (e.g. { lastSleep: {...} })
  },
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const now = Date.now() / 1000;
  const ref = await addDoc(
    collection(db, opts.collectionName, opts.childUid, opts.subcollection),
    opts.interval,
  );
  await setDoc(
    doc(db, opts.collectionName, opts.childUid),
    {
      prefs: {
        ...opts.prefs,
        timestamp: { seconds: now },
        local_timestamp: now,
      },
    },
    { merge: true },
  );
  return ref.id;
}
```

> Note: every interval body MUST include `lastUpdated: Date.now() / 1000`. Compute
> it once per call and reuse it in both the interval and (where relevant) prefs.

---

## 1. Models (`src/models/*.ts`, T1.3)

Replace the current models with these Zod schemas. Numbers are `z.number()`.
Make optional fields `.optional()`. Export each schema + its inferred type from
`src/models/index.ts`.

```ts
// sleep.ts
export const SleepInterval = z.object({
  start: z.number(),
  duration: z.number(),
  offset: z.number(),
  lastUpdated: z.number().optional(),
  _id: z.string().optional(),
});

// feed.ts — one schema per mode, discriminated by `mode`
export const NursingInterval = z.object({
  mode: z.literal("breast"),
  start: z.number(),
  offset: z.number(),
  leftDuration: z.number().optional(),
  rightDuration: z.number().optional(),
  lastSide: z.enum(["left", "right"]).optional(),
  lastUpdated: z.number().optional(),
});
export const BottleInterval = z.object({
  mode: z.literal("bottle"),
  start: z.number(),
  offset: z.number(),
  amount: z.number(),
  bottleType: z.string(), // e.g. "Breast Milk", "Formula", "Cow Milk"
  units: z.enum(["ml", "oz"]),
  lastUpdated: z.number().optional(),
});
export const SolidsInterval = z.object({
  mode: z.literal("solids"),
  start: z.number(),
  offset: z.number(),
  lastUpdated: z.number().optional(),
  // food refs: out of scope for v1 (see §3.3)
});

// diaper.ts
export const DiaperInterval = z.object({
  mode: z.enum(["pee", "poo", "both", "dry"]),
  start: z.number(),
  offset: z.number(),
  quantity: z.number().optional(), // SCALAR 0|50|100 (little|medium|big)
  color: z.string().optional(),
  consistency: z.string().optional(),
  isPotty: z.boolean().optional(),
  lastUpdated: z.number().optional(),
});

// pump.ts
export const PumpInterval = z.object({
  entryMode: z.enum(["total", "leftright"]),
  start: z.number(),
  offset: z.number(),
  leftAmount: z.number(),
  rightAmount: z.number(),
  units: z.enum(["ml", "oz"]),
  duration: z.number().optional(),
  lastUpdated: z.number().optional(),
});
```

Delete `growthOps`-related model usage from index until growth is un-deferred
(T1.8). Keep `user.ts`/`child.ts` (T1.4) untouched — they are correct.

---

## 2. amount mapping

Diaper `quantity` and similar "little/medium/big" inputs map to scalars:
`{ little: 0, medium: 50, big: 100 }`. Store the **number**, not the word.

---

## 3. Per-tracker ops (rewrite each `src/client/*Ops.ts`)

For each, the write builds the interval body per the model above (with
`offset = client.getOffsetMinutes(eventDate)` and `lastUpdated = Date.now()/1000`),
calls `writeIntervalWithPrefs`, and updates the listed prefs key. Reads use the
universal read pattern and parse with the matching model.

### 3.1 Sleep (`sleepOps.ts`, T1.5)

- `logSleep(client, childUid, startDate, endDate)` →
  interval `{ start, duration: (end-start)/1000, offset, lastUpdated }`;
  prefs `{ lastSleep: { start, offset, duration } }`.
- `getSleepHistory(client, childUid, { limit })` → read+parse `SleepInterval`.
- **Defer** `startSleep`/`pauseSleep`/`resumeSleep`/`completeSleep`/`cancelSleep`
  (active-timer flow — no live sample of the parent `timer` doc yet). Remove them
  for now and update `tools/sleep.ts` to expose only `log_sleep` + `get_sleep_history`.

### 3.2 Feeding (`feedOps.ts`, T1.6)

- `logNursing(client, childUid, { start, leftDuration?, rightDuration?, lastSide? })`
  → `NursingInterval`; prefs `{ lastFeed: { mode:"breast", start, offset, duration: (left+right) }, lastSide: { lastSide, start } }`.
- `logBottle(client, childUid, { start, amount, bottleType, units })`
  → `BottleInterval`; prefs `{ lastFeed: { mode:"bottle", start, offset, duration: 0 }, bottleAmount: amount, bottleUnits: units, bottleType }`.
- `logSolids(client, childUid, { start })` → `SolidsInterval`; prefs
  `{ lastFeed: { mode:"solids", start, offset, duration: 0 } }`.
- All three write to the **`feed`** collection.
- `getFeedHistory(client, childUid, { limit })` → read; parse each doc by
  switching on `mode` (use a `z.discriminatedUnion("mode", [...])` or try-each).

### 3.3 Pump (`feedOps.ts` or `pumpOps.ts`, T1.6)

- Collection is **`pump`** (NOT `feed`).
- `logPump(client, childUid, { start, leftAmount, rightAmount, units, duration?, totalAmount? })`:
  if `totalAmount` given, `entryMode:"total"`, `leftAmount=rightAmount=totalAmount/2`;
  else `entryMode:"leftright"` with the given left/right. Interval = `PumpInterval`.
  prefs `{ lastPump: { start, offset, leftAmount, rightAmount, units, entryMode, duration } }`.
- `listPumpIntervals(client, childUid, { limit })` → read+parse `PumpInterval` from `pump`.

### 3.4 Diaper + Potty (`diaperOps.ts` / current `healthOps.ts`, T1.7)

- Collection is **`diaper`** for BOTH diaper and potty.
- `logDiaper(client, childUid, { mode, start, color?, consistency?, peeAmount?, pooAmount? })`:
  interval `DiaperInterval`; set `quantity` from the amount map if an amount given;
  prefs `{ lastDiaper: { start, offset, mode } }`.
- `logPotty(client, childUid, { mode, start, ... })`: same collection, set
  `isPotty: true` on the interval; prefs `{ lastPotty: { start, offset, mode } }`.
- Rename file away from `healthOps` (health = growth, which is deferred).

### 3.5 Solids custom foods (`solidsOps.ts`, T1.9)

- `types/{childUid}/custom` paths are already correct — keep them. Only the
  `log_solids` write (which lands in `feed`) needs §3.2 treatment.

### 3.6 Growth (T1.8) — **NOW SPEC'D (live-confirmed 2026-06)**

Collection is **`health`**, subcollection **`data`** (NOT `intervals`). Doc auto-id.

**Important — growth is the one tracker that does NOT update parent `prefs`.**
Live data confirmed the `health` parent `prefs` is left untouched on a growth log
(its timestamp stayed stale while the entry was written). So do **not** use
`writeIntervalWithPrefs` here — just `addDoc` the entry to `health/{cid}/data`.
(The Python source's `prefs.lastGrowthEntry` update is wrong for the live app —
ignore it.)

Entry shape (only include the measurements provided):

```ts
// GrowthEntry — health/{cid}/data
{
  mode: "growth",
  start: number,        // epoch seconds
  offset: number,       // client.getOffsetMinutes(eventDate)
  lastUpdated: number,  // Date.now() / 1000
  weight?: number,  weightUnits?: "kg" | "lbs.oz",
  height?: number,  heightUnits?: "cm" | "ft.in",
  head?: number,    headUnits?: "hcm" | "hin",
}
```

Units: **metric** → `kg` / `cm` / `hcm` (live-confirmed); **imperial** →
`lbs.oz` / `ft.in` / `hin` (from Python, not live-confirmed). There is **no**
`type`, `id`, `isNight`, or `multientry_key` field — live entries are lean.

Model (`src/models/growth.ts`): `z.object` with `mode: z.literal("growth")`,
numeric `start`/`offset`/`lastUpdated`, and optional numeric measurements + unit
enums above. Export `GrowthEntry`/`GrowthEntryParsed` from `models/index.ts`.

Ops (`src/client/growthOps.ts`):

- `logGrowth(client, childUid, { weight?, height?, head?, units?: "metric"|"imperial", time? })`
  — require at least one measurement; set the matching `*Units`; `addDoc` to
  `health/{cid}/data`. Returns the new id.
- `getLatestGrowth(client, childUid)` — read `health/{cid}/data`,
  `orderBy("start","desc")`, `limit(1)`, parse with `GrowthEntry`, return it or null.
- `getGrowthHistory(client, childUid, { limit })` — same, no limit-1.

Tools (`src/tools/growth.ts`): register `log_growth`, `get_latest_growth`,
`get_growth_history` and import the module in `src/index.ts` +
`src/__tests__/integration.test.ts` (replace the stub). Unit tests: assert the
exact entry body + that **no** prefs write happens (e.g. `setDoc` not called).

---

## 4. Tools (`src/tools/*.ts`, T2.x)

Update each tool's input schema + handler to match the new op signatures above
(e.g. diaper `quantity` words → scalar; bottle requires `units`/`bottleType`).
Remove tools for deferred/removed ops (sleep timer ops, all growth). Keep tool
names snake_case. The registry/server (`src/server/*`) needs no changes.

---

## 5. Tests

- **Unit (per op):** mock `firebase/firestore`; assert the **exact interval body**
  written (numbers, real field names, `offset`, `lastUpdated` present) AND that the
  parent prefs merge-update fired with the right `last*` key. Use the existing
  `vi.mock` + `vi.hoisted` pattern (see `HuckleberryClient.test.ts`).
- **Live read-back (`live.integration.test.ts`, gated):** for each tracker, read
  the latest interval from the real account and assert it parses with the new Zod
  model. This validates models against real data with **zero test-writes**.
- Update/replace the old ops tests that assert the invented schema.

---

## 6. Definition of done (per tracker)

1. Op writes the exact documented shape (verified by unit test).
2. Parent `prefs.last*` updated.
3. Read parses real data (live read-back test passes when creds present; skipped otherwise).
4. Matching MCP tool updated; `tools` still register and list.
5. All four gates green. Update the task's row in `TASKS.md` to ✅ with a note.
