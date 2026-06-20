import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { randomUUID } from "node:crypto";
import type { HuckleberryClient } from "./HuckleberryClient.js";
import { CustomFood, type CustomFoodParsed } from "../models/index.js";

// ── Constants ──────────────────────────────────────────────────────────────

/** Cloud Storage URL for the curated food database (from py-huckleberry-api). */
const FOOD_DB_URL = "https://storage.googleapis.com/simpleintervals.appspot.com/foods/fooddb.json";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CuratedFood {
  id: string;
  name: string;
  category?: string;
  allergen?: boolean;
}

export interface CreateCustomFoodOptions {
  /** Optional image filename/reference stored on the food. */
  image?: string;
}

export interface ListCustomFoodsOptions {
  /** Include archived foods (default: false, matching the app). */
  includeArchived?: boolean;
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

/**
 * Lists custom solids foods for a child (`types/{cid}/custom`). Keeps only
 * solids-typed (or legacy untyped) foods, drops archived unless `includeArchived`,
 * and sorts newest-updated first — matching the Python `list_solids_custom_foods`.
 */
export async function listCustomFoods(
  client: HuckleberryClient,
  childUid: string,
  options: ListCustomFoodsOptions = {},
): Promise<CustomFoodParsed[]> {
  await client.connect();
  const db = client.getFirestore();
  const col = collection(db, customFoodsPath(childUid));
  const snap = await getDocs(col);
  return snap.docs
    .map((d) => CustomFood.parse({ id: d.id, childUid, ...d.data() }))
    .filter((f) => f.type === undefined || f.type === "solids")
    .filter((f) => options.includeArchived || !f.archived)
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
}

/**
 * Creates a custom solids food (`types/{cid}/custom/{id}`). Returns the new food
 * id (also the document id, so it can be referenced as a food in `log_solids`).
 *
 * Shape ported from the Python `create_solids_custom_food`
 * (`type:"solids"`, `source:"custom"`, `archived`, `image`, ISO `created_at`/
 * `updated_at`) — NOT yet confirmed against a real app-created document. Verify by
 * creating a food in the app and inspecting `types/{cid}/custom`.
 */
export async function createCustomFood(
  client: HuckleberryClient,
  childUid: string,
  name: string,
  options: CreateCustomFoodOptions = {},
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const id = randomUUID();
  const nowIso = new Date().toISOString();
  await setDoc(doc(db, "types", childUid, "custom", id), {
    id,
    name,
    type: "solids",
    source: "custom",
    archived: false,
    image: options.image ?? "",
    created_at: nowIso,
    updated_at: nowIso,
  });
  return id;
}
