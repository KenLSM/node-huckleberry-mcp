import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { GrowthRecord, type GrowthRecordParsed } from "../models/index.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type GrowthUnit = "metric" | "imperial";

export interface LogGrowthOptions {
  /** Weight in kg (metric) or lbs (imperial). */
  weight?: number;
  weightUnit?: GrowthUnit;
  /** Height/length in cm (metric) or inches (imperial). */
  height?: number;
  heightUnit?: GrowthUnit;
  /** Head circumference in cm (metric) or inches (imperial). */
  headCircumference?: number;
  headCircumferenceUnit?: GrowthUnit;
  note?: string;
  /** Override time (defaults to now). */
  time?: Date;
}

/** Logs a growth measurement. Returns the new record ID. */
export async function logGrowth(
  client: HuckleberryClient,
  childUid: string,
  options: LogGrowthOptions,
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, `growth/${childUid}/records`);
  const ref = await addDoc(col, {
    date: options.time ? Timestamp.fromDate(options.time) : Timestamp.now(),
    cid: childUid,
    ...(options.weight !== undefined && {
      weight: options.weight,
      weightUnit: options.weightUnit ?? "metric",
    }),
    ...(options.height !== undefined && {
      height: options.height,
      heightUnit: options.heightUnit ?? "metric",
    }),
    ...(options.headCircumference !== undefined && {
      headCircumference: options.headCircumference,
      headCircumferenceUnit: options.headCircumferenceUnit ?? "metric",
    }),
    ...(options.note !== undefined && { note: options.note }),
  });
  return ref.id;
}

/** Returns the most recent growth record, or null if none exist. */
export async function getLatestGrowth(
  client: HuckleberryClient,
  childUid: string,
): Promise<GrowthRecordParsed | null> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, `growth/${childUid}/records`);
  const q = query(col, orderBy("date", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return GrowthRecord.parse(snap.docs[0].data());
}

export interface GrowthHistoryOptions {
  limit?: number;
}

/** Returns growth records ordered by date descending. */
export async function getGrowthHistory(
  client: HuckleberryClient,
  childUid: string,
  options: GrowthHistoryOptions = {},
): Promise<GrowthRecordParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, `growth/${childUid}/records`);
  const q = query(col, orderBy("date", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => GrowthRecord.parse(d.data()));
}
