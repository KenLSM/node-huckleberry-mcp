import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const { mockAddDoc, mockGetDocs, mockCollection } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "food-id" })),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
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

  it("createCustomFood writes to types/{cid}/custom with defaults", async () => {
    await createCustomFood(client, "cid", "Mango", { category: "fruit" });
    const [colRef, body] = mockAddDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(colRef.path).toBe("types/cid/custom");
    expect(body).toMatchObject({
      name: "Mango",
      childUid: "cid",
      allergens: [],
      category: "fruit",
    });
    expect(typeof body.createdAt).toBe("number");
  });

  it("listCustomFoods parses docs with id + childUid merged in", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: "food-1", data: () => ({ name: "Mango", createdAt: 1, updatedAt: 2 }) }],
    });
    const foods = await listCustomFoods(client, "cid");
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ id: "food-1", childUid: "cid", name: "Mango", allergens: [] });
  });
});
