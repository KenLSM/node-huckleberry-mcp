import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAddDoc,
  mockGetDocs,
  mockQuery,
  mockCollection,
  mockOrderBy,
  mockLimit,
  MockTimestamp,
} = vi.hoisted(() => {
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
    mockQuery: vi.fn((...args: unknown[]) => ({ __query: args })),
    mockCollection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
    mockOrderBy: vi.fn(() => ({ __orderBy: true })),
    mockLimit: vi.fn(() => ({ __limit: true })),
    MockTimestamp,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  Timestamp: MockTimestamp,
}));

import { logGrowth, getLatestGrowth, getGrowthHistory } from "../client/growthOps";

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

describe("logGrowth()", () => {
  it("logs weight with default metric unit", async () => {
    mockAddDoc.mockResolvedValue({ id: "growth-1" });
    const id = await logGrowth(makeClient(), CHILD, { weight: 6.5 });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("growth-1");
    expect(data.weight).toBe(6.5);
    expect(data.weightUnit).toBe("metric");
    expect(data.cid).toBe(CHILD);
  });

  it("logs height and head circumference", async () => {
    mockAddDoc.mockResolvedValue({ id: "g2" });
    await logGrowth(makeClient(), CHILD, { height: 60, headCircumference: 38 });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.height).toBe(60);
    expect(data.headCircumference).toBe(38);
  });

  it("respects imperial units", async () => {
    mockAddDoc.mockResolvedValue({ id: "g3" });
    await logGrowth(makeClient(), CHILD, { weight: 14, weightUnit: "imperial" });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.weightUnit).toBe("imperial");
  });

  it("uses provided time", async () => {
    mockAddDoc.mockResolvedValue({ id: "g4" });
    const t = new Date("2024-01-15T09:00:00Z");
    await logGrowth(makeClient(), CHILD, { weight: 7, time: t });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.date as { seconds: number };
    expect(ts.seconds).toBe(Math.floor(t.getTime() / 1000));
  });
});

describe("getLatestGrowth()", () => {
  it("returns the most recent growth record", async () => {
    const raw = { date: { seconds: 1_700_000_000, nanoseconds: 0 }, weight: 7.2 };
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ data: () => raw }] });
    const result = await getLatestGrowth(makeClient(), CHILD);
    expect(result).not.toBeNull();
    expect(result?.weight).toBe(7.2);
  });

  it("returns null when no records exist", async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    const result = await getLatestGrowth(makeClient(), CHILD);
    expect(result).toBeNull();
  });

  it("queries with limit 1", async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    await getLatestGrowth(makeClient(), CHILD);
    expect(mockLimit).toHaveBeenCalledWith(1);
  });
});

describe("getGrowthHistory()", () => {
  it("returns all growth records", async () => {
    const raw = { date: { seconds: 1_700_000_000, nanoseconds: 0 }, weight: 7.0 };
    mockGetDocs.mockResolvedValue({ docs: [{ data: () => raw }] });
    const history = await getGrowthHistory(makeClient(), CHILD);
    expect(history).toHaveLength(1);
    expect(history[0].date).toBeInstanceOf(Date);
  });

  it("defaults to limit 50", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await getGrowthHistory(makeClient(), CHILD);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });
});
