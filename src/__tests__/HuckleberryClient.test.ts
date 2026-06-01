import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Firebase mocks ─────────────────────────────────────────────────────────
// vi.mock is hoisted, so shared mock fns must come from vi.hoisted().

const {
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
} = vi.hoisted(() => ({
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
}));

vi.mock("firebase/app", () => ({
  initializeApp: () => ({}),
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
    client = new HuckleberryClient({ credentials: CREDS });
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
