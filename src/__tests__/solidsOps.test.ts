import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAddDoc, mockGetDocs, mockCollection, MockTimestamp, mockFetch } = vi.hoisted(() => {
  class MockTimestamp {
    static now() {
      return { seconds: 1_700_000_000, nanoseconds: 0 };
    }
    static fromDate(d: Date) {
      return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
    }
  }
  return {
    mockAddDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockCollection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
    MockTimestamp,
    mockFetch: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: MockTimestamp,
}));

// Patch global fetch
vi.stubGlobal("fetch", mockFetch);

import {
  listCuratedFoods,
  listCustomFoods,
  createCustomFood,
  logSolids,
} from "../client/solidsOps";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeClient() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    getFirestore: vi.fn().mockReturnValue({}),
  } as unknown as import("../client/HuckleberryClient").HuckleberryClient;
}

const CHILD = "child-1";

describe("listCuratedFoods()", () => {
  it("fetches and returns food array from Cloud Storage", async () => {
    const foods = [
      { id: "f1", name: "Apple" },
      { id: "f2", name: "Banana" },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(foods) });
    const result = await listCuratedFoods();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Apple");
  });

  it("unwraps {foods: [...]} envelope", async () => {
    const wrapped = { foods: [{ id: "f1", name: "Carrot" }] };
    mockFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(wrapped) });
    const result = await listCuratedFoods();
    expect(result[0].name).toBe("Carrot");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    await expect(listCuratedFoods()).rejects.toThrow("404");
  });
});

describe("listCustomFoods()", () => {
  it("returns custom foods from Firestore with id injected", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "food-1",
          data: () => ({
            name: "Mango",
            childUid: CHILD,
            allergens: [],
            createdAt: 1_700_000_000,
            updatedAt: 1_700_000_000,
          }),
        },
      ],
    });
    const foods = await listCustomFoods(makeClient(), CHILD);
    expect(foods).toHaveLength(1);
    expect(foods[0].name).toBe("Mango");
    expect(foods[0].id).toBe("food-1");
  });
});

describe("createCustomFood()", () => {
  it("creates a custom food and returns its id", async () => {
    mockAddDoc.mockResolvedValue({ id: "new-food" });
    const id = await createCustomFood(makeClient(), CHILD, "Avocado", { category: "fruit" });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("new-food");
    expect(data.name).toBe("Avocado");
    expect(data.category).toBe("fruit");
    expect(data.childUid).toBe(CHILD);
  });

  it("defaults allergens to empty array", async () => {
    mockAddDoc.mockResolvedValue({ id: "f2" });
    await createCustomFood(makeClient(), CHILD, "Peanut");
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.allergens).toEqual([]);
  });
});

describe("logSolids()", () => {
  it("creates a completed solids record with food ids", async () => {
    mockAddDoc.mockResolvedValue({ id: "solids-1" });
    const id = await logSolids(makeClient(), CHILD, ["f1", "f2"], {
      amount: 50,
      notes: "liked it",
    });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("solids-1");
    expect(data.type).toBe("solids");
    expect(data.foods).toEqual(["f1", "f2"]);
    expect(data.amount).toBe(50);
    expect(data.notes).toBe("liked it");
    expect(data.status).toBe("completed");
  });

  it("uses provided time", async () => {
    mockAddDoc.mockResolvedValue({ id: "s2" });
    const t = new Date("2024-01-15T12:00:00Z");
    await logSolids(makeClient(), CHILD, ["f1"], { time: t });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.startTime as { seconds: number };
    expect(ts.seconds).toBe(Math.floor(t.getTime() / 1000));
  });
});
