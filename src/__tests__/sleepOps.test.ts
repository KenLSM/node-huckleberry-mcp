import { describe, it, expect, beforeEach, vi } from "vitest";
import type { HuckleberryClient } from "../client/HuckleberryClient.js";

const { mockAddDoc, mockSetDoc, mockGetDocs, mockCollection, mockDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(async () => ({ id: "sleep-id" })),
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

import { logSleep, getSleepHistory } from "../client/sleepOps.js";

const OFFSET = -480;
const client = {
  connect: vi.fn(async () => ({})),
  getFirestore: () => ({}),
  getOffsetMinutes: () => OFFSET,
} as unknown as HuckleberryClient;

beforeEach(() => vi.clearAllMocks());

describe("sleepOps", () => {
  it("logSleep writes interval + prefs.lastSleep with seconds duration", async () => {
    await logSleep(client, "cid", new Date(1000 * 1000), new Date(1300 * 1000));

    const [colRef, body] = mockAddDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(colRef.path).toBe("sleep/cid/intervals");
    expect(body).toMatchObject({ start: 1000, duration: 300, offset: OFFSET });
    expect(typeof body.lastUpdated).toBe("number");
    expect(body.notes).toBeUndefined();

    const prefs = (mockSetDoc.mock.calls[0][1] as { prefs: { lastSleep: unknown } }).prefs;
    expect(prefs.lastSleep).toEqual({ start: 1000, offset: OFFSET, duration: 300 });
  });

  it("logSleep writes notes when provided", async () => {
    await logSleep(client, "cid", new Date(1000 * 1000), new Date(1300 * 1000), {
      notes: "fussy bedtime",
    });
    const body = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(body.notes).toBe("fussy bedtime");
  });

  it("getSleepHistory reads sleep/intervals and parses entries", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ start: 5, duration: 10, offset: OFFSET, lastUpdated: 6 }) }],
    });
    const items = await getSleepHistory(client, "cid", { limit: 3 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ start: 5, duration: 10, offset: OFFSET });
  });
});
