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
  mockAddDoc: vi.fn(async () => ({ id: "sleep-id" })),
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

import { logSleep, getSleepHistory, editSleep, deleteSleep } from "../client/sleepOps.js";

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

  it("getSleepHistory reads sleep/intervals and includes the doc id", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "sleep-7", data: () => ({ start: 5, duration: 10, offset: OFFSET, lastUpdated: 6 }) },
      ],
    });
    const items = await getSleepHistory(client, "cid", { limit: 3 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "sleep-7", start: 5, duration: 10, offset: OFFSET });
  });
});

describe("editSleep", () => {
  it("updates only provided fields on sleep/{cid}/intervals/{id} + bumps lastUpdated", async () => {
    await editSleep(client, "cid", "sleep-7", { duration: 1800, notes: "moved nap" });
    const [ref, patch] = mockUpdateDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("sleep/cid/intervals/sleep-7");
    expect(patch).toMatchObject({ duration: 1800, notes: "moved nap" });
    expect(typeof patch.lastUpdated).toBe("number");
    expect(patch.start).toBeUndefined();
  });

  it("throws when no fields are provided", async () => {
    await expect(editSleep(client, "cid", "sleep-7", {})).rejects.toThrow("at least one");
  });
});

describe("deleteSleep", () => {
  it("deletes sleep/{cid}/intervals/{id}", async () => {
    await deleteSleep(client, "cid", "sleep-7");
    const ref = mockDeleteDoc.mock.calls[0][0] as { path: string };
    expect(ref.path).toBe("sleep/cid/intervals/sleep-7");
  });
});
