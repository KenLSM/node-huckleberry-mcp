import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

// Mock firebase/firestore so we can assert the exact document bodies written.
// collection()/doc() return the path so we can verify the right collection.
const { mockAddDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockCollection, mockDoc } = vi.hoisted(
  () => ({
    mockAddDoc: vi.fn(async () => ({ id: "new-id" })),
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

import {
  logNursing,
  logBottle,
  logSolids,
  logPump,
  listPumpIntervals,
  getFeedHistory,
  editFeed,
} from "../client/feedOps.js";

const OFFSET = -480;
const client = {
  connect: vi.fn(async () => ({})),
  getFirestore: () => ({}),
  getOffsetMinutes: () => OFFSET,
} as unknown as HuckleberryClient;

function lastInterval() {
  return mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
}
function lastIntervalPath() {
  return (mockAddDoc.mock.calls[0][0] as { path: string }).path;
}
function lastPrefs() {
  return (mockSetDoc.mock.calls[0][1] as { prefs: Record<string, unknown> }).prefs;
}

beforeEach(() => vi.clearAllMocks());

describe("feedOps writes", () => {
  it("logNursing writes to feed/intervals with seconds-duration prefs (no /1000)", async () => {
    await logNursing(client, "cid", {
      start: 1000,
      leftDuration: 600,
      rightDuration: 600,
      lastSide: "left",
    });
    expect(lastIntervalPath()).toBe("feed/cid/intervals");
    expect(lastInterval()).toMatchObject({
      mode: "breast",
      start: 1000,
      offset: OFFSET,
      leftDuration: 600,
      rightDuration: 600,
      lastSide: "left",
    });
    const prefs = lastPrefs() as { lastFeed: { duration: number }; lastSide: unknown };
    // Regression: durations are seconds already → 600+600 = 1200, not 1.2.
    expect(prefs.lastFeed.duration).toBe(1200);
    expect(prefs.lastSide).toEqual({ lastSide: "left", start: 1000 });
  });

  it("logBottle writes feed/intervals + bottle prefs (with optional notes)", async () => {
    await logBottle(client, "cid", {
      start: 5,
      amount: 177,
      bottleType: "Breast Milk",
      units: "ml",
      notes: "took it well",
    });
    expect(lastIntervalPath()).toBe("feed/cid/intervals");
    expect(lastInterval()).toMatchObject({
      mode: "bottle",
      amount: 177,
      bottleType: "Breast Milk",
      units: "ml",
      notes: "took it well",
    });
    expect(lastPrefs()).toMatchObject({
      bottleAmount: 177,
      bottleUnits: "ml",
      bottleType: "Breast Milk",
    });
  });

  it("logBottle omits notes when not provided", async () => {
    await logBottle(client, "cid", { start: 5, amount: 90, bottleType: "Formula", units: "ml" });
    expect(lastInterval().notes).toBeUndefined();
  });

  it("logSolids writes feed/intervals with mode solids", async () => {
    await logSolids(client, "cid", { start: 9 });
    expect(lastIntervalPath()).toBe("feed/cid/intervals");
    expect(lastInterval()).toMatchObject({ mode: "solids", start: 9, offset: OFFSET });
  });

  it("logPump writes to the pump collection and splits totalAmount", async () => {
    await logPump(client, "cid", {
      start: 1,
      leftAmount: 0,
      rightAmount: 0,
      units: "oz",
      totalAmount: 12,
      duration: 480,
    });
    expect(lastIntervalPath()).toBe("pump/cid/intervals");
    expect(lastInterval()).toMatchObject({
      entryMode: "total",
      leftAmount: 6,
      rightAmount: 6,
      units: "oz",
      duration: 480,
    });
  });
});

describe("feedOps reads", () => {
  it("listPumpIntervals parses pump-shaped docs (no `mode` field)", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            entryMode: "total",
            start: 1,
            offset: OFFSET,
            leftAmount: 6,
            rightAmount: 6,
            units: "oz",
            duration: 480,
            lastUpdated: 2,
          }),
        },
      ],
    });
    // Regression: parsing pump docs with the FeedingInterval union threw (no `mode`).
    const res = await listPumpIntervals(client, "cid");
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ entryMode: "total", leftAmount: 6, units: "oz" });
  });

  it("getFeedHistory includes the doc id (needed for editFeed)", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "feed-123", data: () => ({ mode: "bottle", start: 1, amount: 90, units: "ml" }) },
      ],
    });
    const res = await getFeedHistory(client, "cid");
    expect(res[0]).toMatchObject({ id: "feed-123", mode: "bottle", amount: 90 });
  });
});

describe("editFeed", () => {
  it("updates only provided fields on feed/{cid}/intervals/{id} + bumps lastUpdated", async () => {
    await editFeed(client, "cid", "feed-123", { amount: 150, units: "ml" });
    const [ref, patch] = mockUpdateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("feed/cid/intervals/feed-123");
    expect(patch).toMatchObject({ amount: 150, units: "ml" });
    expect(typeof patch.lastUpdated).toBe("number");
    expect(patch.bottleType).toBeUndefined();
  });

  it("throws when no fields are provided", async () => {
    await expect(editFeed(client, "cid", "feed-123", {})).rejects.toThrow("at least one");
  });
});
