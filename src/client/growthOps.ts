import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { GrowthEntry, type GrowthEntryParsed } from "../models/index.js";

export type GrowthUnits = "metric" | "imperial";

export interface LogGrowthOptions {
  /** Event time (defaults to now). */
  time?: Date;
  weight?: number;
  height?: number;
  head?: number;
  units?: GrowthUnits;
  notes?: string;
}

const METRIC = { weight: "kg", height: "cm", head: "hcm" } as const;
const IMPERIAL = { weight: "lbs.oz", height: "ft.in", head: "hin" } as const;

/**
 * Logs a growth measurement to health/{childUid}/data.
 *
 * Growth is the one tracker that does NOT update the parent `prefs` summary, so
 * this writes the entry directly (no writeIntervalWithPrefs). Returns the new id.
 */
export async function logGrowth(
  client: HuckleberryClient,
  childUid: string,
  options: LogGrowthOptions,
): Promise<string> {
  if (options.weight === undefined && options.height === undefined && options.head === undefined) {
    throw new Error("logGrowth requires at least one of weight, height, or head");
  }

  const eventDate = options.time ?? new Date();
  const u = options.units === "imperial" ? IMPERIAL : METRIC;

  const entry: Record<string, unknown> = {
    mode: "growth",
    start: eventDate.getTime() / 1000,
    offset: client.getOffsetMinutes(eventDate),
    lastUpdated: Date.now() / 1000,
    ...(options.weight !== undefined && { weight: options.weight, weightUnits: u.weight }),
    ...(options.height !== undefined && { height: options.height, heightUnits: u.height }),
    ...(options.head !== undefined && { head: options.head, headUnits: u.head }),
    ...(options.notes !== undefined && { notes: options.notes }),
  };

  await client.connect();
  const db = client.getFirestore();
  const ref = await addDoc(collection(db, "health", childUid, "data"), entry);
  return ref.id;
}

export interface GrowthHistoryOptions {
  limit?: number;
}

/** Returns growth entries ordered by start descending. Each entry includes its
 * Firestore doc `id` so it can be referenced by `editGrowth`. */
export async function getGrowthHistory(
  client: HuckleberryClient,
  childUid: string,
  options: GrowthHistoryOptions = {},
): Promise<(GrowthEntryParsed & { id: string })[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "health", childUid, "data");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  // health/{cid}/data may hold non-growth health entries; keep only growth.
  return snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((d) => (d.data as { mode?: unknown }).mode === "growth")
    .map((d) => ({ id: d.id, ...GrowthEntry.parse(d.data) }));
}

/** Returns the most recent growth entry (incl. `id`), or null if none exist. */
export async function getLatestGrowth(
  client: HuckleberryClient,
  childUid: string,
): Promise<(GrowthEntryParsed & { id: string }) | null> {
  const items = await getGrowthHistory(client, childUid, { limit: 1 });
  return items[0] ?? null;
}

// ── Edit growth ──────────────────────────────────────────────────────────────

export interface EditGrowthOptions {
  /** Event time (epoch seconds). */
  start?: number;
  weight?: number;
  height?: number;
  head?: number;
  /** Unit system applied to whichever measurements are provided. */
  units?: GrowthUnits;
  notes?: string;
}

/**
 * Updates fields on an existing growth entry (`health/{cid}/data/{id}`). Only the
 * provided fields are changed; `lastUpdated` is bumped. Each provided measurement
 * also sets its unit field based on `units` (defaults to metric). The entry id
 * comes from `getGrowthHistory` / `getLatestGrowth`.
 */
export async function editGrowth(
  client: HuckleberryClient,
  childUid: string,
  entryId: string,
  updates: EditGrowthOptions,
): Promise<void> {
  const u = updates.units === "imperial" ? IMPERIAL : METRIC;
  const patch: Record<string, unknown> = {
    ...(updates.start !== undefined && { start: updates.start }),
    ...(updates.weight !== undefined && { weight: updates.weight, weightUnits: u.weight }),
    ...(updates.height !== undefined && { height: updates.height, heightUnits: u.height }),
    ...(updates.head !== undefined && { head: updates.head, headUnits: u.head }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
  };
  if (Object.keys(patch).length === 0) {
    throw new Error("editGrowth requires at least one field to update");
  }
  patch.lastUpdated = Date.now() / 1000;

  await client.connect();
  const db = client.getFirestore();
  await updateDoc(doc(db, "health", childUid, "data", entryId), patch);
}
