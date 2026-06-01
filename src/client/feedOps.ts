import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { FeedingInterval, type FeedingIntervalParsed } from "../models/index.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type FeedType = "nursing" | "bottle" | "pump";
export type NursingSide = "left" | "right" | "both";

function feedIntervalsPath(childUid: string) {
  return `feed/${childUid}/intervals`;
}

function nowTs() {
  return Timestamp.now();
}

// ── History ────────────────────────────────────────────────────────────────

export interface FeedHistoryOptions {
  limit?: number;
}

export async function getFeedHistory(
  client: HuckleberryClient,
  childUid: string,
  options: FeedHistoryOptions = {},
): Promise<FeedingIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, feedIntervalsPath(childUid));
  const q = query(col, orderBy("startTime", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => FeedingInterval.parse(d.data()));
}

// ── Nursing ────────────────────────────────────────────────────────────────

export interface StartNursingOptions {
  side?: NursingSide;
  notes?: string;
  startTime?: Date;
}

/** Starts a nursing session. Returns the new interval ID. */
export async function startNursing(
  client: HuckleberryClient,
  childUid: string,
  options: StartNursingOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, feedIntervalsPath(childUid));
  const ref = await addDoc(col, {
    startTime: options.startTime ? Timestamp.fromDate(options.startTime) : nowTs(),
    status: "active",
    type: "nursing",
    cid: childUid,
    ...(options.side !== undefined && { side: options.side }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}

/** Pauses an active nursing session. */
export async function pauseNursing(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  await updateDoc(doc(db, feedIntervalsPath(childUid), intervalId), {
    status: "paused",
    pauseTime: nowTs(),
  });
}

/** Resumes a paused nursing session. */
export async function resumeNursing(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  await updateDoc(doc(db, feedIntervalsPath(childUid), intervalId), {
    status: "active",
    pauseTime: null,
  });
}

/** Switches the active nursing side. */
export async function switchNursingSide(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
  newSide: NursingSide,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  await updateDoc(doc(db, feedIntervalsPath(childUid), intervalId), {
    side: newSide,
  });
}

export interface CompleteNursingOptions {
  notes?: string;
  endTime?: Date;
}

/** Completes a nursing session. */
export async function completeNursing(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
  options: CompleteNursingOptions = {},
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  await updateDoc(doc(db, feedIntervalsPath(childUid), intervalId), {
    status: "completed",
    endTime: options.endTime ? Timestamp.fromDate(options.endTime) : nowTs(),
    pauseTime: null,
    ...(options.notes !== undefined && { notes: options.notes }),
  });
}

export interface LogNursingOptions {
  side?: NursingSide;
  notes?: string;
}

/** Logs a completed nursing session with explicit times. Returns the new ID. */
export async function logNursing(
  client: HuckleberryClient,
  childUid: string,
  startTime: Date,
  endTime: Date,
  options: LogNursingOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, feedIntervalsPath(childUid));
  const ref = await addDoc(col, {
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: "completed",
    type: "nursing",
    cid: childUid,
    ...(options.side !== undefined && { side: options.side }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}

// ── Bottle ─────────────────────────────────────────────────────────────────

export interface LogBottleOptions {
  notes?: string;
  amountUnit?: "ml" | "oz";
}

/** Logs a bottle feeding. Returns the new interval ID. */
export async function logBottle(
  client: HuckleberryClient,
  childUid: string,
  startTime: Date,
  endTime: Date,
  amount: number,
  options: LogBottleOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, feedIntervalsPath(childUid));
  const ref = await addDoc(col, {
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: "completed",
    type: "bottle",
    amount,
    amountUnit: options.amountUnit ?? "ml",
    cid: childUid,
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}

// ── Pump ───────────────────────────────────────────────────────────────────

export interface LogPumpOptions {
  notes?: string;
  amountUnit?: "ml" | "oz";
}

/** Logs a pumping session. Returns the new interval ID. */
export async function logPump(
  client: HuckleberryClient,
  childUid: string,
  startTime: Date,
  endTime: Date,
  amount?: number,
  options: LogPumpOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, feedIntervalsPath(childUid));
  const ref = await addDoc(col, {
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: "completed",
    type: "pump",
    cid: childUid,
    ...(amount !== undefined && { amount, amountUnit: options.amountUnit ?? "ml" }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}

export interface PumpHistoryOptions {
  limit?: number;
}

/** Returns pump sessions for a child ordered by startTime descending. */
export async function listPumpIntervals(
  client: HuckleberryClient,
  childUid: string,
  options: PumpHistoryOptions = {},
): Promise<FeedingIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, feedIntervalsPath(childUid));
  // Query all feed intervals and filter client-side (Firestore single-field inequality limit)
  const q = query(col, orderBy("startTime", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => FeedingInterval.parse(d.data()))
    .filter((interval) => interval.type === "pump");
}
