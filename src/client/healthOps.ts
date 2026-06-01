import { collection, addDoc, Timestamp } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { DiaperLog, type DiaperLogParsed } from "../models/index.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type DiaperType = "pee" | "poo" | "both" | "dry";
export type DiaperColor =
  | "yellow"
  | "brown"
  | "green"
  | "black"
  | "red"
  | "white"
  | "orange"
  | "other";
export type DiaperConsistency = "hard" | "normal" | "soft" | "runny" | "watery" | "formed" | "mucousy";

export interface LogDiaperOptions {
  color?: DiaperColor;
  consistency?: DiaperConsistency;
  note?: string;
  /** Override time (defaults to now). */
  time?: Date;
}

/** Logs a diaper change to health/{childUid}/diapers/{id}. Returns the new ID. */
export async function logDiaper(
  client: HuckleberryClient,
  childUid: string,
  type: DiaperType,
  options: LogDiaperOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, `health/${childUid}/diapers`);
  const ref = await addDoc(col, {
    date: options.time ? Timestamp.fromDate(options.time) : Timestamp.now(),
    type,
    cid: childUid,
    ...(options.color !== undefined && { color: options.color }),
    ...(options.consistency !== undefined && { consistency: options.consistency }),
    ...(options.note !== undefined && { note: options.note }),
  });
  return ref.id;
}

export interface LogPottyOptions {
  note?: string;
  /** Override time (defaults to now). */
  time?: Date;
}

/** Logs a potty event (treated as a pee/poo diaper without a diaper). Returns the new ID. */
export async function logPotty(
  client: HuckleberryClient,
  childUid: string,
  type: DiaperType,
  options: LogPottyOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, `health/${childUid}/potty`);
  const ref = await addDoc(col, {
    date: options.time ? Timestamp.fromDate(options.time) : Timestamp.now(),
    type,
    cid: childUid,
    potty: true,
    ...(options.note !== undefined && { note: options.note }),
  });
  return ref.id;
}
