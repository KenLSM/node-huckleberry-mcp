import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { SleepInterval, type SleepIntervalParsed } from "../models/index.js";
import { writeIntervalWithPrefs } from "./prefs.js";

export interface LogSleepOptions {
  /** Override time (defaults to now). */
  time?: Date;
  /** Free-text note attached to the entry. */
  notes?: string;
}

/**
 * Logs a completed sleep session with explicit start and end times.
 * Returns the new document ID.
 */
export async function logSleep(
  client: HuckleberryClient,
  childUid: string,
  startDate: Date,
  endDate: Date,
  options: LogSleepOptions = {},
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const start = startDate.getTime() / 1000;
  const end = endDate.getTime() / 1000;
  const duration = end - start;
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  return writeIntervalWithPrefs(client, {
    collectionName: "sleep",
    subcollection: "intervals",
    childUid,
    interval: {
      start,
      duration,
      offset,
      ...(options.notes !== undefined && { notes: options.notes }),
      lastUpdated,
    },
    prefs: {
      lastSleep: {
        start,
        offset,
        duration,
      },
    },
  });
}

export interface SleepHistoryOptions {
  /** Maximum number of records to return (default: 50). */
  limit?: number;
}

/**
 * Returns sleep intervals for a child, ordered by start descending. Each entry
 * includes its Firestore doc `id` so it can be referenced by `editSleep`.
 */
export async function getSleepHistory(
  client: HuckleberryClient,
  childUid: string,
  options: SleepHistoryOptions = {},
): Promise<(SleepIntervalParsed & { id: string })[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "sleep", childUid, "intervals");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...SleepInterval.parse(d.data()) }));
}

// ── Edit sleep ───────────────────────────────────────────────────────────────

export interface EditSleepOptions {
  /** Event start (epoch seconds). */
  start?: number;
  /** Duration in seconds. */
  duration?: number;
  notes?: string;
}

/**
 * Updates fields on an existing sleep interval (`sleep/{cid}/intervals/{id}`).
 * Only the provided fields are changed; `lastUpdated` is bumped. The interval id
 * comes from `getSleepHistory`. Does not touch the parent `prefs` summary.
 */
export async function editSleep(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
  updates: EditSleepOptions,
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...(updates.start !== undefined && { start: updates.start }),
    ...(updates.duration !== undefined && { duration: updates.duration }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
  };
  if (Object.keys(patch).length === 0) {
    throw new Error("editSleep requires at least one field to update");
  }
  patch.lastUpdated = Date.now() / 1000;

  await client.connect();
  const db = client.getFirestore();
  await updateDoc(doc(db, "sleep", childUid, "intervals", intervalId), patch);
}

// ── Delete sleep ─────────────────────────────────────────────────────────────

/**
 * Permanently deletes a sleep interval (`sleep/{cid}/intervals/{id}`). The id
 * comes from `getSleepHistory`. Does **not** recompute the parent `prefs.lastSleep`
 * summary, so it may briefly still reference a deleted entry until the next write.
 */
export async function deleteSleep(
  client: HuckleberryClient,
  childUid: string,
  intervalId: string,
): Promise<void> {
  await client.connect();
  const db = client.getFirestore();
  await deleteDoc(doc(db, "sleep", childUid, "intervals", intervalId));
}
