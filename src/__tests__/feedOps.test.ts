import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAddDoc,
  mockUpdateDoc,
  mockGetDocs,
  mockQuery,
  mockCollection,
  mockDoc,
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
    mockUpdateDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => ({ __query: args })),
    mockCollection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
    mockDoc: vi.fn((_db: unknown, path: string, id: string) => ({ __path: `${path}/${id}` })),
    mockOrderBy: vi.fn(() => ({ __orderBy: true })),
    mockLimit: vi.fn(() => ({ __limit: true })),
    MockTimestamp,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  Timestamp: MockTimestamp,
}));

import {
  startNursing,
  pauseNursing,
  resumeNursing,
  switchNursingSide,
  completeNursing,
  logNursing,
  logBottle,
  logPump,
  listPumpIntervals,
  getFeedHistory,
} from "../client/feedOps";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeClient() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    getFirestore: vi.fn().mockReturnValue({}),
    getUid: vi.fn().mockResolvedValue("uid-abc"),
  } as unknown as import("../client/HuckleberryClient").HuckleberryClient;
}

const CHILD = "child-1";
const START = new Date("2024-01-15T08:00:00Z");
const END = new Date("2024-01-15T08:30:00Z");

// ── startNursing ───────────────────────────────────────────────────────────

describe("startNursing()", () => {
  it("creates an active nursing interval and returns its id", async () => {
    mockAddDoc.mockResolvedValue({ id: "nursing-1" });
    const id = await startNursing(makeClient(), CHILD);
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("nursing-1");
    expect(data.status).toBe("active");
    expect(data.type).toBe("nursing");
    expect(data.cid).toBe(CHILD);
  });

  it("includes side and notes when provided", async () => {
    mockAddDoc.mockResolvedValue({ id: "n2" });
    await startNursing(makeClient(), CHILD, { side: "left", notes: "hungry" });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.side).toBe("left");
    expect(data.notes).toBe("hungry");
  });

  it("uses provided startTime", async () => {
    mockAddDoc.mockResolvedValue({ id: "n3" });
    await startNursing(makeClient(), CHILD, { startTime: START });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.startTime as { seconds: number };
    expect(ts.seconds).toBe(Math.floor(START.getTime() / 1000));
  });
});

// ── pauseNursing ───────────────────────────────────────────────────────────

describe("pauseNursing()", () => {
  it("sets status=paused and adds pauseTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await pauseNursing(makeClient(), CHILD, "interval-1");
    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("paused");
    expect(data.pauseTime).toBeDefined();
  });
});

// ── resumeNursing ──────────────────────────────────────────────────────────

describe("resumeNursing()", () => {
  it("sets status=active and clears pauseTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await resumeNursing(makeClient(), CHILD, "interval-1");
    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("active");
    expect(data.pauseTime).toBeNull();
  });
});

// ── switchNursingSide ──────────────────────────────────────────────────────

describe("switchNursingSide()", () => {
  it("updates the side field", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await switchNursingSide(makeClient(), CHILD, "interval-1", "right");
    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.side).toBe("right");
  });
});

// ── completeNursing ────────────────────────────────────────────────────────

describe("completeNursing()", () => {
  it("sets status=completed and endTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await completeNursing(makeClient(), CHILD, "interval-1");
    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("completed");
    expect(data.endTime).toBeDefined();
    expect(data.pauseTime).toBeNull();
  });

  it("uses provided endTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await completeNursing(makeClient(), CHILD, "interval-1", { endTime: END });
    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.endTime as { seconds: number };
    expect(ts.seconds).toBe(Math.floor(END.getTime() / 1000));
  });
});

// ── logNursing ─────────────────────────────────────────────────────────────

describe("logNursing()", () => {
  it("creates a completed nursing record", async () => {
    mockAddDoc.mockResolvedValue({ id: "log-1" });
    const id = await logNursing(makeClient(), CHILD, START, END, { side: "both" });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("log-1");
    expect(data.status).toBe("completed");
    expect(data.type).toBe("nursing");
    expect(data.side).toBe("both");
    const st = data.startTime as { seconds: number };
    expect(st.seconds).toBe(Math.floor(START.getTime() / 1000));
  });
});

// ── logBottle ──────────────────────────────────────────────────────────────

describe("logBottle()", () => {
  it("creates a completed bottle record with amount", async () => {
    mockAddDoc.mockResolvedValue({ id: "bottle-1" });
    const id = await logBottle(makeClient(), CHILD, START, END, 120);
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("bottle-1");
    expect(data.type).toBe("bottle");
    expect(data.amount).toBe(120);
    expect(data.amountUnit).toBe("ml");
  });

  it("respects custom amountUnit", async () => {
    mockAddDoc.mockResolvedValue({ id: "b2" });
    await logBottle(makeClient(), CHILD, START, END, 4, { amountUnit: "oz" });
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.amountUnit).toBe("oz");
  });
});

// ── logPump ────────────────────────────────────────────────────────────────

describe("logPump()", () => {
  it("creates a completed pump record", async () => {
    mockAddDoc.mockResolvedValue({ id: "pump-1" });
    const id = await logPump(makeClient(), CHILD, START, END, 80);
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(id).toBe("pump-1");
    expect(data.type).toBe("pump");
    expect(data.amount).toBe(80);
  });

  it("omits amount when not provided", async () => {
    mockAddDoc.mockResolvedValue({ id: "p2" });
    await logPump(makeClient(), CHILD, START, END);
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.amount).toBeUndefined();
  });
});

// ── listPumpIntervals ──────────────────────────────────────────────────────

describe("listPumpIntervals()", () => {
  it("returns only pump-type intervals", async () => {
    const intervals = [
      { startTime: { seconds: 1_700_000_000, nanoseconds: 0 }, status: "completed", type: "pump" },
      { startTime: { seconds: 1_700_000_100, nanoseconds: 0 }, status: "completed", type: "nursing" },
    ];
    mockGetDocs.mockResolvedValue({ docs: intervals.map((d) => ({ data: () => d })) });
    const results = await listPumpIntervals(makeClient(), CHILD);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("pump");
  });
});

// ── getFeedHistory ─────────────────────────────────────────────────────────

describe("getFeedHistory()", () => {
  it("returns parsed feed intervals ordered by startTime", async () => {
    const raw = { startTime: { seconds: 1_700_000_000, nanoseconds: 0 }, status: "completed", type: "nursing" };
    mockGetDocs.mockResolvedValue({ docs: [{ data: () => raw }] });
    const history = await getFeedHistory(makeClient(), CHILD);
    expect(history).toHaveLength(1);
    expect(history[0].startTime).toBeInstanceOf(Date);
  });

  it("defaults to limit 50", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await getFeedHistory(makeClient(), CHILD);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });
});
