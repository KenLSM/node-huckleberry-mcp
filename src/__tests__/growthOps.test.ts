import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const { mockAddDoc, mockSetDoc, mockGetDocs, mockCollection } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "growth-id" })),
  mockSetDoc: vi.fn(async () => undefined),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  query: (col: unknown) => col,
  orderBy: () => ({}),
  limit: () => ({}),
}));

import { logGrowth, getLatestGrowth } from "../client/growthOps.js";

const OFFSET = -480;
const client = {
  connect: vi.fn(async () => ({})),
  getFirestore: () => ({}),
  getOffsetMinutes: () => OFFSET,
} as unknown as HuckleberryClient;

beforeEach(() => vi.clearAllMocks());

describe("growthOps", () => {
  it("logGrowth writes to health/{cid}/data with metric units and NO prefs", async () => {
    await logGrowth(client, "cid", {
      time: new Date(2_000_000 * 1000),
      weight: 3.1,
      height: 21.6,
      head: 38,
    });
    const [colRef, body] = mockAddDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(colRef.path).toBe("health/cid/data");
    expect(body).toMatchObject({
      mode: "growth",
      start: 2_000_000,
      offset: OFFSET,
      weight: 3.1,
      weightUnits: "kg",
      height: 21.6,
      heightUnits: "cm",
      head: 38,
      headUnits: "hcm",
    });
    expect(typeof body.lastUpdated).toBe("number");
    // Growth must NOT touch the parent prefs summary.
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("logGrowth applies imperial units and omits absent measurements", async () => {
    await logGrowth(client, "cid", { weight: 7, units: "imperial" });
    const body = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({ weight: 7, weightUnits: "lbs.oz" });
    expect(body.height).toBeUndefined();
    expect(body.head).toBeUndefined();
  });

  it("logGrowth throws when no measurement is given", async () => {
    await expect(logGrowth(client, "cid", {})).rejects.toThrow("at least one");
  });

  it("getLatestGrowth parses the newest entry", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            mode: "growth",
            start: 1,
            offset: OFFSET,
            weight: 3.1,
            weightUnits: "kg",
            lastUpdated: 2,
          }),
        },
      ],
    });
    const latest = await getLatestGrowth(client, "cid");
    expect(latest).toMatchObject({ mode: "growth", weight: 3.1, weightUnits: "kg" });
  });
});
