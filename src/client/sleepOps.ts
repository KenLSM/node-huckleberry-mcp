import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { SleepInterval, type SleepIntervalParsed } from "../models/index.js";
import { writeIntervalWithPrefs } from "./prefs.js";

export interface LogSleepOptions {
  /** Override time (defaults to now). */
  time?: Date;
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
 * Returns sleep intervals for a child, ordered by start descending.
 */
export async function getSleepHistory(
  client: HuckleberryClient,
  childUid: string,
  options: SleepHistoryOptions = {},
): Promise<SleepIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "sleep", childUid, "intervals");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => SleepInterval.parse(d.data()));
}
