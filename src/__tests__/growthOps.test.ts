import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const {
  mockAddDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockGetDocs,
  mockCollection,
  mockDoc,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "growth-id" })),
  mockSetDoc: vi.fn(async () => undefined),
  mockUpdateDoc: vi.fn(async () => undefined),
  mockDeleteDoc: vi.fn(async () => undefined),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
  mockDoc: vi.fn((_db: unknown, ...seg: string[]) => ({ path: seg.join("/") })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  query: (col: unknown) => col,
  orderBy: () => ({}),
  limit: () => ({}),
}));

import {
  logGrowth,
  getLatestGrowth,
  getGrowthHistory,
  editGrowth,
  deleteGrowth,
} from "../client/growthOps.js";

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
    expect(body.notes).toBeUndefined();
  });

  it("logGrowth writes notes when provided", async () => {
    await logGrowth(client, "cid", { weight: 7, notes: "at the pediatrician" });
    const body = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(body.notes).toBe("at the pediatrician");
  });

  it("logGrowth throws when no measurement is given", async () => {
    await expect(logGrowth(client, "cid", {})).rejects.toThrow("at least one");
  });

  it("getLatestGrowth parses the newest entry and includes the doc id", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: "growth-3",
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
    expect(latest).toMatchObject({
      id: "growth-3",
      mode: "growth",
      weight: 3.1,
      weightUnits: "kg",
    });
  });

  it("getGrowthHistory filters to growth and includes the doc id", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "growth-3", data: () => ({ mode: "growth", start: 2, weight: 4 }) },
        { id: "other-1", data: () => ({ mode: "temperature", start: 1 }) },
      ],
    });
    const items = await getGrowthHistory(client, "cid", { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "growth-3", mode: "growth", weight: 4 });
  });
});

describe("editGrowth", () => {
  it("updates measurements with unit fields + bumps lastUpdated", async () => {
    await editGrowth(client, "cid", "growth-3", { weight: 4.2, notes: "recheck" });
    const [ref, patch] = mockUpdateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("health/cid/data/growth-3");
    expect(patch).toMatchObject({ weight: 4.2, weightUnits: "kg", notes: "recheck" });
    expect(typeof patch.lastUpdated).toBe("number");
    expect(patch.height).toBeUndefined();
  });

  it("applies imperial units to provided measurements", async () => {
    await editGrowth(client, "cid", "growth-3", { weight: 9, units: "imperial" });
    const patch = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).toMatchObject({ weight: 9, weightUnits: "lbs.oz" });
  });

  it("throws when no fields are provided", async () => {
    await expect(editGrowth(client, "cid", "growth-3", {})).rejects.toThrow("at least one");
  });
});

describe("deleteGrowth", () => {
  it("deletes health/{cid}/data/{id}", async () => {
    await deleteGrowth(client, "cid", "growth-3");
    expect((mockDeleteDoc.mock.calls[0][0] as { path: string }).path).toBe(
      "health/cid/data/growth-3",
    );
  });
});
