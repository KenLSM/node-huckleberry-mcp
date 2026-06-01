import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Firebase mock (must use unstable_mockModule for ESM) ───────────────────

const mockSignInWithEmailAndPassword = jest.fn();
const mockOnIdTokenChanged = jest.fn(() => () => {});
const mockSignOut = jest.fn();

const mockAuth = {
  currentUser: null as {
    uid: string;
    getIdToken: ReturnType<typeof jest.fn>;
    getIdTokenResult: ReturnType<typeof jest.fn>;
  } | null,
  signOut: mockSignOut,
};

jest.unstable_mockModule("firebase/auth", () => ({
  getAuth: () => mockAuth,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  onIdTokenChanged: mockOnIdTokenChanged,
}));

// Dynamic import after mock registration
const { HuckleberryAuth } = await import("../auth/auth.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUser(uid: string, expiresInMs = 3600_000) {
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue("id-token-" + uid),
    getIdTokenResult: jest.fn().mockResolvedValue({ expirationTime: expiresAt }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("HuckleberryAuth", () => {
  let hbAuth: InstanceType<typeof HuckleberryAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = null;
    mockOnIdTokenChanged.mockReturnValue(() => {});
    hbAuth = new HuckleberryAuth({} as never);
  });

  it("authenticate() stores session and returns it", async () => {
    const user = makeUser("uid-abc");
    mockSignInWithEmailAndPassword.mockResolvedValue({ user });

    const session = await hbAuth.authenticate({ email: "a@b.com", password: "pw" });

    expect(session.uid).toBe("uid-abc");
    expect(session.idToken).toBe("id-token-uid-abc");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(hbAuth.getSession()).toEqual(session);
  });

  it("ensureSession() throws when not authenticated", async () => {
    await expect(hbAuth.ensureSession()).rejects.toThrow("Not authenticated");
  });

  it("ensureSession() returns session without refresh when token is fresh", async () => {
    const user = makeUser("uid-abc", 3600_000);
    mockSignInWithEmailAndPassword.mockResolvedValue({ user });
    await hbAuth.authenticate({ email: "a@b.com", password: "pw" });

    const refreshSpy = jest.spyOn(hbAuth, "refreshSessionToken");
    const session = await hbAuth.ensureSession();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(session.uid).toBe("uid-abc");
  });

  it("ensureSession() calls refreshSessionToken when token is expiring soon", async () => {
    const user = makeUser("uid-abc", 2 * 60 * 1000); // expires in 2 min (< 5 min margin)
    mockSignInWithEmailAndPassword.mockResolvedValue({ user });
    mockAuth.currentUser = user;
    await hbAuth.authenticate({ email: "a@b.com", password: "pw" });

    const refreshedToken = "id-token-refreshed";
    (user.getIdToken as ReturnType<typeof jest.fn>).mockResolvedValueOnce(refreshedToken);

    const session = await hbAuth.ensureSession();
    expect(session.idToken).toBe(refreshedToken);
  });

  it("refreshSessionToken() throws when no current user", async () => {
    mockAuth.currentUser = null;
    (hbAuth as unknown as { session: object }).session = { uid: "x", idToken: "t", expiresAt: 0 };
    await expect(hbAuth.refreshSessionToken()).rejects.toThrow("Cannot refresh");
  });

  it("refreshSessionToken() updates session with fresh token", async () => {
    const user = makeUser("uid-abc");
    mockSignInWithEmailAndPassword.mockResolvedValue({ user });
    mockAuth.currentUser = user;
    await hbAuth.authenticate({ email: "a@b.com", password: "pw" });

    const newToken = "id-token-refreshed";
    (user.getIdToken as ReturnType<typeof jest.fn>).mockResolvedValueOnce(newToken);

    const session = await hbAuth.refreshSessionToken();
    expect(session.idToken).toBe(newToken);
    expect(hbAuth.getSession()?.idToken).toBe(newToken);
  });

  it("signOut() clears the session", async () => {
    const user = makeUser("uid-abc");
    mockSignInWithEmailAndPassword.mockResolvedValue({ user });
    await hbAuth.authenticate({ email: "a@b.com", password: "pw" });

    await hbAuth.signOut();

    expect(hbAuth.getSession()).toBeNull();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
