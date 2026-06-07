import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const { mockAddDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockCollection, mockDoc } = vi.hoisted(
  () => ({
    mockAddDoc: vi.fn(async () => ({ id: "diaper-id" })),
    mockSetDoc: vi.fn(async () => undefined),
    mockUpdateDoc: vi.fn(async () => undefined),
    mockGetDocs: vi.fn(),
    mockCollection: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
    mockDoc: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
  }),
);

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  query: (col: unknown) => col,
  orderBy: () => ({}),
  limit: () => ({}),
}));

import { logDiaper, logPotty, getDiaperHistory, editDiaper } from "../client/diaperOps.js";

const OFFSET = -480;
const client = {
  connect: vi.fn(async () => ({})),
  getFirestore: () => ({}),
  getOffsetMinutes: () => OFFSET,
} as unknown as HuckleberryClient;

const interval = () => mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
const intervalPath = () => (mockAddDoc.mock.calls[0][0] as { path: string }).path;
const prefs = () => (mockSetDoc.mock.calls[0][1] as { prefs: Record<string, unknown> }).prefs;

beforeEach(() => vi.clearAllMocks());

describe("diaperOps", () => {
  it("logDiaper writes to diaper/intervals with scalar quantity + prefs.lastDiaper", async () => {
    await logDiaper(client, "cid", {
      mode: "poo",
      start: 100,
      color: "yellow",
      pooAmount: "medium",
    });
    expect(intervalPath()).toBe("diaper/cid/intervals");
    expect(interval()).toMatchObject({
      mode: "poo",
      start: 100,
      offset: OFFSET,
      color: "yellow",
      quantity: 50, // medium → 50 (scalar, not a {pee,poo} map)
    });
    expect(prefs().lastDiaper).toEqual({ start: 100, offset: OFFSET, mode: "poo" });
    expect(interval().notes).toBeUndefined();
  });

  it("logDiaper and logPotty write notes when provided", async () => {
    await logDiaper(client, "cid", { mode: "pee", start: 1, notes: "leaked" });
    expect(interval().notes).toBe("leaked");
    vi.clearAllMocks();
    await logPotty(client, "cid", { mode: "pee", start: 2, notes: "first time!" });
    expect(interval().notes).toBe("first time!");
  });

  it("logPotty writes to the diaper collection with isPotty + prefs.lastPotty", async () => {
    await logPotty(client, "cid", { mode: "pee", start: 200 });
    expect(intervalPath()).toBe("diaper/cid/intervals");
    expect(interval()).toMatchObject({ mode: "pee", start: 200, offset: OFFSET, isPotty: true });
    expect(prefs().lastPotty).toEqual({ start: 200, offset: OFFSET, mode: "pee" });
  });

  it("getDiaperHistory parses scalar + map quantity and passes through extras", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ mode: "poo", start: 1, offset: OFFSET, quantity: 100 }) },
        // "both" diaper with a per-type quantity map + a potty extra field.
        {
          data: () => ({
            mode: "both",
            start: 2,
            quantity: { pee: 50, poo: 100 },
            isPotty: true,
            howItHappened: "wentPotty",
          }),
        },
      ],
    });
    const items = await getDiaperHistory(client, "cid", { limit: 5 });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ mode: "poo", quantity: 100 });
    expect(items[1].quantity).toEqual({ pee: 50, poo: 100 });
  });

  it("getDiaperHistory includes the doc id (needed for editDiaper)", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: "diaper-9", data: () => ({ mode: "pee", start: 1, offset: OFFSET }) }],
    });
    const items = await getDiaperHistory(client, "cid", { limit: 5 });
    expect(items[0]).toMatchObject({ id: "diaper-9", mode: "pee" });
  });
});

describe("editDiaper", () => {
  it("updates only provided fields (amount → quantity) + bumps lastUpdated", async () => {
    await editDiaper(client, "cid", "diaper-9", { color: "green", pooAmount: "big" });
    const [ref, patch] = mockUpdateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("diaper/cid/intervals/diaper-9");
    expect(patch).toMatchObject({ color: "green", quantity: 100 });
    expect(typeof patch.lastUpdated).toBe("number");
    expect(patch.mode).toBeUndefined();
  });

  it("throws when no fields are provided", async () => {
    await expect(editDiaper(client, "cid", "diaper-9", {})).rejects.toThrow("at least one");
  });
});
