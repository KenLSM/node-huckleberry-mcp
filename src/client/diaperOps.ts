import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { DiaperInterval, type DiaperIntervalParsed } from "../models/index.js";
import { writeIntervalWithPrefs } from "./prefs.js";

const AMOUNT_MAP = { little: 0, medium: 50, big: 100 };

export interface LogDiaperOptions {
  mode: "pee" | "poo" | "both" | "dry";
  start: number;
  color?: string;
  consistency?: string;
  peeAmount?: "little" | "medium" | "big";
  pooAmount?: "little" | "medium" | "big";
  notes?: string;
  time?: Date;
}

/** Logs a diaper change. Returns the new interval ID. */
export async function logDiaper(
  client: HuckleberryClient,
  childUid: string,
  options: LogDiaperOptions,
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  let quantity: number | undefined;
  if (options.peeAmount !== undefined) {
    quantity = AMOUNT_MAP[options.peeAmount];
  } else if (options.pooAmount !== undefined) {
    quantity = AMOUNT_MAP[options.pooAmount];
  }

  return writeIntervalWithPrefs(client, {
    collectionName: "diaper",
    subcollection: "intervals",
    childUid,
    interval: {
      mode: options.mode,
      start: options.start,
      offset,
      ...(quantity !== undefined && { quantity }),
      ...(options.color !== undefined && { color: options.color }),
      ...(options.consistency !== undefined && { consistency: options.consistency }),
      ...(options.notes !== undefined && { notes: options.notes }),
      lastUpdated,
    },
    prefs: {
      lastDiaper: {
        start: options.start,
        offset,
        mode: options.mode,
      },
    },
  });
}

export interface LogPottyOptions {
  mode: "pee" | "poo";
  start: number;
  notes?: string;
  time?: Date;
}

/** Logs potty training activity. Returns the new interval ID. */
export async function logPotty(
  client: HuckleberryClient,
  childUid: string,
  options: LogPottyOptions,
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  return writeIntervalWithPrefs(client, {
    collectionName: "diaper",
    subcollection: "intervals",
    childUid,
    interval: {
      mode: options.mode,
      start: options.start,
      offset,
      isPotty: true,
      ...(options.notes !== undefined && { notes: options.notes }),
      lastUpdated,
    },
    prefs: {
      lastPotty: {
        start: options.start,
        offset,
        mode: options.mode,
      },
    },
  });
}

export interface DiaperHistoryOptions {
  limit?: number;
}

/** Returns diaper intervals for a child, ordered by start descending. */
export async function getDiaperHistory(
  client: HuckleberryClient,
  childUid: string,
  options: DiaperHistoryOptions = {},
): Promise<DiaperIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "diaper", childUid, "intervals");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => DiaperInterval.parse(d.data()));
}
