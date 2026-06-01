import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Firebase mocks ─────────────────────────────────────────────────────────
// vi.mock is hoisted, so shared mock fns must come from vi.hoisted().

const {
  apps,
  mockInitializeApp,
  mockGetApp,
  mockGetApps,
  mockGetDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockAddDoc,
  mockDoc,
  mockCollection,
  mockAuthenticate,
  mockEnsureSession,
  mockGetSession,
  mockAuthSignOut,
} = vi.hoisted(() => {
  // Stateful firebase/app mock that reproduces the real app/duplicate-app error.
  const apps: { name: string }[] = [];
  return {
    apps,
    mockInitializeApp: vi.fn((_config: unknown, name: string) => {
      if (apps.some((a) => a.name === name)) {
        throw new Error(`Firebase: app/duplicate-app: ${name}`);
      }
      const app = { name };
      apps.push(app);
      return app;
    }),
    mockGetApp: vi.fn((name: string) => apps.find((a) => a.name === name)),
    mockGetApps: vi.fn(() => apps),
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockAddDoc: vi.fn(),
    mockDoc: vi.fn((...args: unknown[]) => ({ __path: (args.slice(1) as string[]).join("/") })),
    mockCollection: vi.fn((...args: unknown[]) => ({
      __path: (args.slice(1) as string[]).join("/"),
    })),
    mockAuthenticate: vi.fn(),
    mockEnsureSession: vi.fn(),
    mockGetSession: vi.fn(),
    mockAuthSignOut: vi.fn(),
  };
});

vi.mock("firebase/app", () => ({
  initializeApp: mockInitializeApp,
  getApp: mockGetApp,
  getApps: mockGetApps,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: mockDoc,
  collection: mockCollection,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  addDoc: mockAddDoc,
}));

vi.mock("../auth/auth.js", () => ({
  HuckleberryAuth: class {
    authenticate = mockAuthenticate;
    ensureSession = mockEnsureSession;
    getSession = mockGetSession;
    signOut = mockAuthSignOut;
  },
}));

import { HuckleberryClient } from "../client/HuckleberryClient";

// ── Tests ──────────────────────────────────────────────────────────────────

const CREDS = { email: "a@b.com", password: "pw" };
const SESSION = { uid: "uid-abc", idToken: "tok", expiresAt: Date.now() + 3_600_000 };

describe("HuckleberryClient", () => {
  let client: InstanceType<typeof HuckleberryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    apps.length = 0; // fresh app registry; the line below performs the first init
    client = new HuckleberryClient({ credentials: CREDS });
  });

  describe("Firebase app lifecycle", () => {
    it("reuses the named app on a second instance (no app/duplicate-app)", () => {
      // beforeEach already performed the one and only initializeApp.
      expect(() => new HuckleberryClient({ credentials: CREDS })).not.toThrow();
      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
      expect(apps).toHaveLength(1);
    });
  });

  describe("connect() concurrency", () => {
    it("shares a single sign-in across concurrent first-time callers", async () => {
      mockGetSession.mockReturnValue(null);
      let resolveAuth!: (s: unknown) => void;
      mockAuthenticate.mockReturnValue(
        new Promise((res) => {
          resolveAuth = res;
        }),
      );

      const p1 = client.connect();
      const p2 = client.connect();
      resolveAuth(SESSION);
      const [s1, s2] = await Promise.all([p1, p2]);

      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(s1).toEqual(SESSION);
      expect(s2).toEqual(SESSION);
    });
  });

  describe("connect()", () => {
    it("authenticates when no existing session", async () => {
      mockGetSession.mockReturnValue(null);
      mockAuthenticate.mockResolvedValue(SESSION);

      const session = await client.connect();

      expect(mockAuthenticate).toHaveBeenCalledWith(CREDS);
      expect(session).toEqual(SESSION);
    });

    it("calls ensureSession when a session already exists", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);

      const session = await client.connect();

      expect(mockAuthenticate).not.toHaveBeenCalled();
      expect(mockEnsureSession).toHaveBeenCalled();
      expect(session).toEqual(SESSION);
    });
  });

  describe("readDoc()", () => {
    it("returns document data when document exists", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);
      const data = { name: "Ada" };
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => data });

      const result = await client.readDoc("users", "uid-abc");

      expect(mockDoc).toHaveBeenCalled();
      expect(result).toEqual(data);
    });

    it("returns null when document does not exist", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await client.readDoc("users", "missing-uid");

      expect(result).toBeNull();
    });
  });

  describe("writeDoc()", () => {
    it("calls setDoc with the provided data", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);
      mockSetDoc.mockResolvedValue(undefined);

      await client.writeDoc({ foo: "bar" }, "test", "doc1");

      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe("updateDoc()", () => {
    it("calls updateDoc with partial data", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);
      mockUpdateDoc.mockResolvedValue(undefined);

      await client.updateDoc({ foo: "updated" }, "test", "doc1");

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe("deleteDoc()", () => {
    it("calls deleteDoc", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);
      mockDeleteDoc.mockResolvedValue(undefined);

      await client.deleteDoc("test", "doc1");

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe("addToCollection()", () => {
    it("returns the generated document id", async () => {
      mockGetSession.mockReturnValue(SESSION);
      mockEnsureSession.mockResolvedValue(SESSION);
      mockAddDoc.mockResolvedValue({ id: "generated-id" });

      const id = await client.addToCollection({ x: 1 }, "sleep", "uid-abc", "intervals");

      expect(id).toBe("generated-id");
    });
  });

  describe("getUid()", () => {
    it("returns uid from session", async () => {
      mockEnsureSession.mockResolvedValue(SESSION);

      const uid = await client.getUid();

      expect(uid).toBe("uid-abc");
    });
  });

  describe("signOut()", () => {
    it("delegates to auth.signOut()", async () => {
      await client.signOut();
      expect(mockAuthSignOut).toHaveBeenCalled();
    });
  });
});
