import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firebase mock ──────────────────────────────────────────────────────────

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
  const now = new Date("2024-01-15T10:00:00Z");
  class MockTimestamp {
    static now() {
      return { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 };
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
  startSleep,
  pauseSleep,
  resumeSleep,
  completeSleep,
  cancelSleep,
  logSleep,
  getSleepHistory,
} from "../client/sleepOps";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Mock client ────────────────────────────────────────────────────────────

function makeClient() {
  const mockDb = {};
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    getFirestore: vi.fn().mockReturnValue(mockDb),
    getUid: vi.fn().mockResolvedValue("uid-abc"),
  } as unknown as import("../client/HuckleberryClient").HuckleberryClient;
}

const CHILD_UID = "child-1";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("startSleep()", () => {
  it("adds a new interval doc with status=active and returns its id", async () => {
    mockAddDoc.mockResolvedValue({ id: "interval-new" });
    const client = makeClient();

    const id = await startSleep(client, CHILD_UID);

    expect(mockAddDoc).toHaveBeenCalledOnce();
    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("active");
    expect(data.cid).toBe(CHILD_UID);
    expect(id).toBe("interval-new");
  });

  it("sets type and notes when provided", async () => {
    mockAddDoc.mockResolvedValue({ id: "interval-2" });
    const client = makeClient();

    await startSleep(client, CHILD_UID, { type: "nap", notes: "after lunch" });

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.type).toBe("nap");
    expect(data.notes).toBe("after lunch");
  });

  it("uses provided startTime when given", async () => {
    mockAddDoc.mockResolvedValue({ id: "i3" });
    const client = makeClient();
    const t = new Date("2024-01-15T08:00:00Z");
    const expectedSeconds = Math.floor(t.getTime() / 1000);

    await startSleep(client, CHILD_UID, { startTime: t });

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.startTime as { seconds: number };
    expect(ts.seconds).toBe(expectedSeconds);
  });
});

describe("pauseSleep()", () => {
  it("updates status to paused and sets pauseTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const client = makeClient();

    await pauseSleep(client, CHILD_UID, "interval-1");

    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("paused");
    expect(data.pauseTime).toBeDefined();
  });
});

describe("resumeSleep()", () => {
  it("updates status to active and clears pauseTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const client = makeClient();

    await resumeSleep(client, CHILD_UID, "interval-1");

    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("active");
    expect(data.pauseTime).toBeNull();
  });
});

describe("completeSleep()", () => {
  it("updates status to completed and sets endTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const client = makeClient();

    await completeSleep(client, CHILD_UID, "interval-1");

    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("completed");
    expect(data.endTime).toBeDefined();
    expect(data.pauseTime).toBeNull();
  });

  it("uses provided endTime", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const client = makeClient();
    const t = new Date("2024-01-15T09:00:00Z");

    await completeSleep(client, CHILD_UID, "interval-1", { endTime: t });

    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    const ts = data.endTime as { seconds: number };
    expect(ts.seconds).toBe(Math.floor(t.getTime() / 1000));
  });
});

describe("cancelSleep()", () => {
  it("updates status to cancelled", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const client = makeClient();

    await cancelSleep(client, CHILD_UID, "interval-1");

    const [, data] = mockUpdateDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("cancelled");
  });
});

describe("logSleep()", () => {
  it("creates a completed interval with explicit start and end times", async () => {
    mockAddDoc.mockResolvedValue({ id: "interval-logged" });
    const client = makeClient();
    const start = new Date("2024-01-15T08:00:00Z");
    const end = new Date("2024-01-15T09:30:00Z");

    const id = await logSleep(client, CHILD_UID, start, end, { type: "nap" });

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.status).toBe("completed");
    expect(data.type).toBe("nap");
    expect(id).toBe("interval-logged");
    const st = data.startTime as { seconds: number };
    const et = data.endTime as { seconds: number };
    expect(st.seconds).toBe(Math.floor(start.getTime() / 1000));
    expect(et.seconds).toBe(Math.floor(end.getTime() / 1000));
  });
});

describe("getSleepHistory()", () => {
  it("returns parsed sleep intervals", async () => {
    const raw = {
      startTime: { seconds: 1705312800, nanoseconds: 0 },
      endTime: { seconds: 1705318200, nanoseconds: 0 },
      status: "completed",
      cid: CHILD_UID,
    };
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => raw }],
    });
    const client = makeClient();

    const history = await getSleepHistory(client, CHILD_UID);

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("completed");
    expect(history[0].startTime).toBeInstanceOf(Date);
  });

  it("defaults to limit 50", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const client = makeClient();

    await getSleepHistory(client, CHILD_UID);

    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it("respects custom limit option", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const client = makeClient();

    await getSleepHistory(client, CHILD_UID, { limit: 10 });

    expect(mockLimit).toHaveBeenCalledWith(10);
  });
});
