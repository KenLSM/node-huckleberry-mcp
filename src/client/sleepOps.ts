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
import { SleepInterval, type SleepIntervalParsed, type SleepType } from "../models/index.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function nowTimestamp() {
  return Timestamp.now();
}

function sleepIntervalsPath(childUid: string) {
  return `sleep/${childUid}/intervals`;
}

// ── Read ───────────────────────────────────────────────────────────────────

export interface SleepHistoryOptions {
  /** Maximum number of records to return (default: 50). */
  limit?: number;
}

/**
 * Returns sleep intervals for a child, ordered by startTime descending.
 */
export async function getSleepHistory(
  client: HuckleberryClient,
  childUid: string,
  options: SleepHistoryOptions = {},
): Promise<SleepIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, sleepIntervalsPath(childUid));
  const q = query(col, orderBy("startTime", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => SleepInterval.parse(d.data()));
}

// ── Write ──────────────────────────────────────────────────────────────────

export interface StartSleepOptions {
  type?: SleepType;
  notes?: string;
  /** Override start time (defaults to now). */
  startTime?: Date;
}

/**
 * Starts a new active sleep interval. Returns the new document ID.
 */
export async function startSleep(
  client: HuckleberryClient,
  childUid: string,
  options: StartSleepOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, sleepIntervalsPath(childUid));
  const ref = await addDoc(col, {
    startTime: options.startTime ? Timestamp.fromDate(options.startTime) : nowTimestamp(),
    status: "active",
    cid: childUid,
    ...(options.type !== undefined && { type: options.type }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}

/**
 * Pauses an active sleep interval.
 */
export async function pauseSleep(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  const ref = doc(db, sleepIntervalsPath(childUid), intervalId);
  await updateDoc(ref, {
    status: "paused",
    pauseTime: nowTimestamp(),
  });
}

/**
 * Resumes a paused sleep interval.
 */
export async function resumeSleep(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  const ref = doc(db, sleepIntervalsPath(childUid), intervalId);
  await updateDoc(ref, {
    status: "active",
    pauseTime: null,
  });
}

export interface CompleteSleepOptions {
  notes?: string;
  type?: SleepType;
  /** Override end time (defaults to now). */
  endTime?: Date;
}

/**
 * Completes an active or paused sleep interval.
 */
export async function completeSleep(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
  options: CompleteSleepOptions = {},
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  const ref = doc(db, sleepIntervalsPath(childUid), intervalId);
  await updateDoc(ref, {
    status: "completed",
    endTime: options.endTime ? Timestamp.fromDate(options.endTime) : nowTimestamp(),
    pauseTime: null,
    ...(options.notes !== undefined && { notes: options.notes }),
    ...(options.type !== undefined && { type: options.type }),
  });
}

/**
 * Cancels an active or paused sleep interval.
 */
export async function cancelSleep(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  const ref = doc(db, sleepIntervalsPath(childUid), intervalId);
  await updateDoc(ref, {
    status: "cancelled",
  });
}

export interface LogSleepOptions {
  type?: SleepType;
  notes?: string;
}

/**
 * Logs a completed sleep session with explicit start and end times.
 * Returns the new document ID.
 */
export async function logSleep(
  client: HuckleberryClient,
  childUid: string,
  startTime: Date,
  endTime: Date,
  options: LogSleepOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, sleepIntervalsPath(childUid));
  const ref = await addDoc(col, {
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: "completed",
    cid: childUid,
    ...(options.type !== undefined && { type: options.type }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}
