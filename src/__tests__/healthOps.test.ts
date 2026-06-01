import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAddDoc, mockCollection, MockTimestamp } = vi.hoisted(() => {
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
    mockCollection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
    MockTimestamp,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  Timestamp: MockTimestamp,
}));

import { logDiaper, logPotty } from "../client/healthOps";

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

describe("logDiaper()", () => {
  it("writes a diaper log with type and returns its id", async () => {
    mockAddDoc.mockResolvedValue({ id: "diaper-1" });
    const id = await logDiaper(makeClient(), CHILD, "poo");
    const [col, data] = mockAddDoc.mock.calls[0] as [{ __path: string }, Record<string, unknown>];
    expect(id).toBe("diaper-1");
    expect(data.type).toBe("poo");
    expect(data.cid).toBe(CHILD);
    expect(col.__path).toContain("health");
  });

  it("includes optional color and consistency", async () => {
    mockAddDoc.mockResolvedValue({ id: "d2" });
    await logDiaper(makeClient(), CHILD, "poo", { color: "yellow", consistency: "soft" });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.color).toBe("yellow");
    expect(data.consistency).toBe("soft");
  });

  it("uses provided time", async () => {
    mockAddDoc.mockResolvedValue({ id: "d3" });
    const t = new Date("2024-01-15T10:00:00Z");
    await logDiaper(makeClient(), CHILD, "pee", { time: t });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.date as { seconds: number };
    expect(ts.seconds).toBe(Math.floor(t.getTime() / 1000));
  });

  it("logs a dry diaper", async () => {
    mockAddDoc.mockResolvedValue({ id: "d4" });
    await logDiaper(makeClient(), CHILD, "dry");
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.type).toBe("dry");
  });
});

describe("logPotty()", () => {
  it("writes to the potty collection with potty=true", async () => {
    mockAddDoc.mockResolvedValue({ id: "potty-1" });
    const id = await logPotty(makeClient(), CHILD, "pee");
    const [col, data] = mockAddDoc.mock.calls[0] as [{ __path: string }, Record<string, unknown>];
    expect(id).toBe("potty-1");
    expect(col.__path).toContain("potty");
    expect(data.potty).toBe(true);
    expect(data.type).toBe("pee");
  });
});
