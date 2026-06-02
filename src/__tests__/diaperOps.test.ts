import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const { mockAddDoc, mockSetDoc, mockGetDocs, mockCollection, mockDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "diaper-id" })),
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
  query: (col: unknown) => col,
  orderBy: () => ({}),
  limit: () => ({}),
}));

import { logDiaper, logPotty, getDiaperHistory } from "../client/diaperOps.js";

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
  });

  it("logPotty writes to the diaper collection with isPotty + prefs.lastPotty", async () => {
    await logPotty(client, "cid", { mode: "pee", start: 200 });
    expect(intervalPath()).toBe("diaper/cid/intervals");
    expect(interval()).toMatchObject({ mode: "pee", start: 200, offset: OFFSET, isPotty: true });
    expect(prefs().lastPotty).toEqual({ start: 200, offset: OFFSET, mode: "pee" });
  });

  it("getDiaperHistory reads diaper/intervals and parses entries", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ mode: "poo", start: 1, offset: OFFSET, quantity: 100 }) }],
    });
    const items = await getDiaperHistory(client, "cid", { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ mode: "poo", quantity: 100 });
  });
});
