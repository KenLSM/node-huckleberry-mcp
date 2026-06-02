import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
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
  };

  await client.connect();
  const db = client.getFirestore();
  const ref = await addDoc(collection(db, "health", childUid, "data"), entry);
  return ref.id;
}

export interface GrowthHistoryOptions {
  limit?: number;
}

/** Returns growth entries ordered by start descending. */
export async function getGrowthHistory(
  client: HuckleberryClient,
  childUid: string,
  options: GrowthHistoryOptions = {},
): Promise<GrowthEntryParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "health", childUid, "data");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => GrowthEntry.parse(d.data()));
}

/** Returns the most recent growth entry, or null if none exist. */
export async function getLatestGrowth(
  client: HuckleberryClient,
  childUid: string,
): Promise<GrowthEntryParsed | null> {
  const items = await getGrowthHistory(client, childUid, { limit: 1 });
  return items[0] ?? null;
}
