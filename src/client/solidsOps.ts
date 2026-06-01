import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { CustomFood, type CustomFoodParsed } from "../models/index.js";

// ── Constants ──────────────────────────────────────────────────────────────

/** Cloud Storage URL for the curated food database (from py-huckleberry-api). */
const FOOD_DB_URL =
  "https://storage.googleapis.com/simpleintervals.appspot.com/foods/fooddb.json";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CuratedFood {
  id: string;
  name: string;
  category?: string;
  allergen?: boolean;
}

export interface LogSolidsOptions {
  amount?: number;
  notes?: string;
  /** Override time (defaults to now). */
  time?: Date;
}

export interface CreateCustomFoodOptions {
  category?: string;
  allergens?: string[];
  notes?: string;
}

// ── Curated foods (Cloud Storage) ─────────────────────────────────────────

/**
 * Fetches the curated food list from Huckleberry's Cloud Storage bucket.
 * No auth required; this is a public JSON file.
 */
export async function listCuratedFoods(): Promise<CuratedFood[]> {
  const resp = await fetch(FOOD_DB_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch curated foods: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as unknown;
  if (Array.isArray(data)) {
    return data as CuratedFood[];
  }
  // Some versions wrap the array in an object
  const obj = data as Record<string, unknown>;
  const arr = obj.foods ?? obj.items ?? obj.data ?? Object.values(obj)[0];
  return Array.isArray(arr) ? (arr as CuratedFood[]) : [];
}

// ── Custom foods (Firestore) ───────────────────────────────────────────────

function customFoodsPath(childUid: string) {
  return `types/${childUid}/custom`;
}

/** Lists custom foods created for a child. */
export async function listCustomFoods(
  client: HuckleberryClient,
  childUid: string,
): Promise<CustomFoodParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, customFoodsPath(childUid));
  const snap = await getDocs(col);
  return snap.docs.map((d) => CustomFood.parse({ id: d.id, childUid, ...d.data() }));
}

/** Creates a custom food entry. Returns the new food ID. */
export async function createCustomFood(
  client: HuckleberryClient,
  childUid: string,
  name: string,
  options: CreateCustomFoodOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, customFoodsPath(childUid));
  const now = Date.now();
  const ref = await addDoc(col, {
    name,
    childUid,
    allergens: options.allergens ?? [],
    createdAt: now,
    updatedAt: now,
    ...(options.category !== undefined && { category: options.category }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}

// ── Log solids ─────────────────────────────────────────────────────────────

/** Logs a solids feeding. `foodIds` are IDs from curated or custom foods. Returns the new ID. */
export async function logSolids(
  client: HuckleberryClient,
  childUid: string,
  foodIds: string[],
  options: LogSolidsOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, `feed/${childUid}/intervals`);
  const ref = await addDoc(col, {
    startTime: options.time ? Timestamp.fromDate(options.time) : Timestamp.now(),
    status: "completed",
    type: "solids",
    foods: foodIds,
    cid: childUid,
    ...(options.amount !== undefined && { amount: options.amount }),
    ...(options.notes !== undefined && { notes: options.notes }),
  });
  return ref.id;
}
