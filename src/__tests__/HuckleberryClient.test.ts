import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Firebase mocks ─────────────────────────────────────────────────────────

const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockDoc = jest.fn((...args: unknown[]) => ({ __path: (args.slice(1) as string[]).join("/") }));
const mockCollection = jest.fn((...args: unknown[]) => ({
  __path: (args.slice(1) as string[]).join("/"),
}));

jest.unstable_mockModule("firebase/app", () => ({
  initializeApp: () => ({}),
}));

jest.unstable_mockModule("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: mockDoc,
  collection: mockCollection,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  addDoc: mockAddDoc,
}));

const mockAuthenticate = jest.fn();
const mockEnsureSession = jest.fn();
const mockGetSession = jest.fn();
const mockAuthSignOut = jest.fn();

jest.unstable_mockModule("../auth/auth.js", () => ({
  HuckleberryAuth: jest.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
    ensureSession: mockEnsureSession,
    getSession: mockGetSession,
    signOut: mockAuthSignOut,
  })),
}));

// Dynamic imports after mock registration
const { HuckleberryClient } = await import("../client/HuckleberryClient.js");

// ── Tests ──────────────────────────────────────────────────────────────────

const CREDS = { email: "a@b.com", password: "pw" };
const SESSION = { uid: "uid-abc", idToken: "tok", expiresAt: Date.now() + 3_600_000 };

describe("HuckleberryClient", () => {
  let client: InstanceType<typeof HuckleberryClient>;

  beforeEach(() => {
    jest.clearAllMocks();
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
