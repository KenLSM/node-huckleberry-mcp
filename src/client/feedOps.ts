import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import {
  FeedingInterval,
  type FeedingIntervalParsed,
  PumpInterval,
  type PumpIntervalParsed,
} from "../models/index.js";
import { writeIntervalWithPrefs } from "./prefs.js";

// ── Nursing ────────────────────────────────────────────────────────────────

export interface LogNursingOptions {
  start: number;
  leftDuration?: number;
  rightDuration?: number;
  lastSide?: "left" | "right";
  time?: Date;
}

/** Logs a nursing session. Returns the new interval ID. */
export async function logNursing(
  client: HuckleberryClient,
  childUid: string,
  options: LogNursingOptions,
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  return writeIntervalWithPrefs(client, {
    collectionName: "feed",
    subcollection: "intervals",
    childUid,
    interval: {
      mode: "breast",
      start: options.start,
      offset,
      ...(options.leftDuration !== undefined && { leftDuration: options.leftDuration }),
      ...(options.rightDuration !== undefined && { rightDuration: options.rightDuration }),
      ...(options.lastSide !== undefined && { lastSide: options.lastSide }),
      lastUpdated,
    },
    prefs: {
      lastFeed: {
        mode: "breast",
        start: options.start,
        offset,
        duration: (options.leftDuration ?? 0) + (options.rightDuration ?? 0),
      },
      ...(options.lastSide !== undefined && {
        lastSide: { lastSide: options.lastSide, start: options.start },
      }),
    },
  });
}

// ── Bottle ─────────────────────────────────────────────────────────────────

export interface LogBottleOptions {
  start: number;
  amount: number;
  bottleType: string;
  units: "ml" | "oz";
  time?: Date;
}

/** Logs a bottle feeding. Returns the new interval ID. */
export async function logBottle(
  client: HuckleberryClient,
  childUid: string,
  options: LogBottleOptions,
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  return writeIntervalWithPrefs(client, {
    collectionName: "feed",
    subcollection: "intervals",
    childUid,
    interval: {
      mode: "bottle",
      start: options.start,
      offset,
      amount: options.amount,
      bottleType: options.bottleType,
      units: options.units,
      lastUpdated,
    },
    prefs: {
      lastFeed: {
        mode: "bottle",
        start: options.start,
        offset,
        duration: 0,
      },
      bottleAmount: options.amount,
      bottleUnits: options.units,
      bottleType: options.bottleType,
    },
  });
}

// ── Solids ─────────────────────────────────────────────────────────────────

export interface LogSolidsOptions {
  start: number;
  time?: Date;
}

/** Logs a solids feeding. Returns the new interval ID. */
export async function logSolids(
  client: HuckleberryClient,
  childUid: string,
  options: LogSolidsOptions,
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  return writeIntervalWithPrefs(client, {
    collectionName: "feed",
    subcollection: "intervals",
    childUid,
    interval: {
      mode: "solids",
      start: options.start,
      offset,
      lastUpdated,
    },
    prefs: {
      lastFeed: {
        mode: "solids",
        start: options.start,
        offset,
        duration: 0,
      },
    },
  });
}

// ── Feed History ───────────────────────────────────────────────────────────

export interface FeedHistoryOptions {
  limit?: number;
}

/** Returns feed intervals for a child, ordered by start descending. */
export async function getFeedHistory(
  client: HuckleberryClient,
  childUid: string,
  options: FeedHistoryOptions = {},
): Promise<FeedingIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "feed", childUid, "intervals");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => FeedingInterval.parse(d.data()));
}

// ── Pump ───────────────────────────────────────────────────────────────────

export interface LogPumpOptions {
  start: number;
  leftAmount: number;
  rightAmount: number;
  units: "ml" | "oz";
  duration?: number;
  totalAmount?: number;
  time?: Date;
}

/** Logs a pumping session. Returns the new interval ID. */
export async function logPump(
  client: HuckleberryClient,
  childUid: string,
  options: LogPumpOptions,
): Promise<string> {
  const eventDate = options.time ?? new Date();
  const offset = client.getOffsetMinutes(eventDate);
  const lastUpdated = Date.now() / 1000;

  let entryMode: "total" | "leftright";
  let leftAmount: number;
  let rightAmount: number;

  if (options.totalAmount !== undefined) {
    entryMode = "total";
    leftAmount = options.totalAmount / 2;
    rightAmount = options.totalAmount / 2;
  } else {
    entryMode = "leftright";
    leftAmount = options.leftAmount;
    rightAmount = options.rightAmount;
  }

  return writeIntervalWithPrefs(client, {
    collectionName: "pump",
    subcollection: "intervals",
    childUid,
    interval: {
      entryMode,
      start: options.start,
      offset,
      leftAmount,
      rightAmount,
      units: options.units,
      ...(options.duration !== undefined && { duration: options.duration }),
      lastUpdated,
    },
    prefs: {
      lastPump: {
        start: options.start,
        offset,
        leftAmount,
        rightAmount,
        units: options.units,
        entryMode,
        ...(options.duration !== undefined && { duration: options.duration }),
      },
    },
  });
}

export interface PumpHistoryOptions {
  limit?: number;
}

/** Returns pump intervals for a child, ordered by start descending. */
export async function listPumpIntervals(
  client: HuckleberryClient,
  childUid: string,
  options: PumpHistoryOptions = {},
): Promise<PumpIntervalParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, "pump", childUid, "intervals");
  const q = query(col, orderBy("start", "desc"), limit(options.limit ?? 50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => PumpInterval.parse(d.data()));
}
