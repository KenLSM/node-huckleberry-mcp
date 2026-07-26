import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const { mockAddDoc, mockSetDoc, mockGetDocs, mockCollection, mockDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "food-id" })),
  mockSetDoc: vi.fn(async () => undefined),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
  mockDoc: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
}));

import { listCuratedFoods, listCustomFoods, createCustomFood } from "../client/solidsOps.js";

const client = {
  connect: vi.fn(async () => ({})),
  getFirestore: () => ({}),
} as unknown as HuckleberryClient;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("solidsOps", () => {
  it("listCuratedFoods fetches the public food DB and returns the array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ id: "apple", name: "Apple" }],
      })),
    );
    const foods = await listCuratedFoods();
    expect(foods).toEqual([{ id: "apple", name: "Apple" }]);
  });

  it("listCuratedFoods unwraps an object-wrapped list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ foods: [{ id: "pear", name: "Pear" }] }),
      })),
    );
    expect(await listCuratedFoods()).toEqual([{ id: "pear", name: "Pear" }]);
  });

  it("createCustomFood setDoc's the real solids shape with id == doc id", async () => {
    const id = await createCustomFood(client, "cid", "Mango", { image: "mango.png" });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    const [ref, body] = mockSetDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe(`types/cid/custom/${id}`);
    expect(body).toMatchObject({
      id,
      name: "Mango",
      type: "solids",
      source: "custom",
      archived: false,
      image: "mango.png",
    });
    // Timestamps are ISO strings, not epoch numbers.
    expect(typeof body.created_at).toBe("string");
    expect(typeof body.updated_at).toBe("string");
  });

  it("listCustomFoods drops archived by default, sorts newest-updated first", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "f-old",
          data: () => ({ name: "Old", type: "solids", archived: false, updated_at: "2026-01-01" }),
        },
        {
          id: "f-arch",
          data: () => ({
            name: "Archived",
            type: "solids",
            archived: true,
            updated_at: "2026-06-01",
          }),
        },
        {
          id: "f-new",
          data: () => ({ name: "New", type: "solids", archived: false, updated_at: "2026-03-01" }),
        },
      ],
    });
    const foods = await listCustomFoods(client, "cid");
    expect(foods.map((f) => f.id)).toEqual(["f-new", "f-old"]); // archived excluded, newest first
    expect(foods[0]).toMatchObject({ childUid: "cid", type: "solids" });
  });

  it("listCustomFoods includes archived when asked", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: "f-arch", data: () => ({ name: "Archived", type: "solids", archived: true }) }],
    });
    const foods = await listCustomFoods(client, "cid", { includeArchived: true });
    expect(foods.map((f) => f.id)).toEqual(["f-arch"]);
  });

  it("listCustomFoods still returns foods written by the pre-B5 code", async () => {
    // Regression: older docs have no `type`/`archived` and numeric camelCase
    // timestamps. The solids filter must not hide them.
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "legacy-1",
          data: () => ({
            name: "Old Mango",
            allergens: [],
            category: "fruit",
            createdAt: 1_717_000_000_000,
            updatedAt: 1_717_000_000_000,
          }),
        },
      ],
    });
    const foods = await listCustomFoods(client, "cid");
    expect(foods.map((f) => f.id)).toEqual(["legacy-1"]);
    expect(foods[0].name).toBe("Old Mango");
  });
});
