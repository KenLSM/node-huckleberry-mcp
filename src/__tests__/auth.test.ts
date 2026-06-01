import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Firebase mock ──────────────────────────────────────────────────────────
// vi.mock is hoisted, so shared mock fns must come from vi.hoisted().

const { mockSignInWithEmailAndPassword, mockOnIdTokenChanged, mockSignOut, mockAuth } = vi.hoisted(
  () => {
    const mockSignOut = vi.fn();
    const mockAuth = {
      currentUser: null as {
        uid: string;
        getIdToken: ReturnType<typeof vi.fn>;
        getIdTokenResult: ReturnType<typeof vi.fn>;
      } | null,
      signOut: mockSignOut,
    };
    return {
      mockSignInWithEmailAndPassword: vi.fn(),
      mockOnIdTokenChanged: vi.fn(() => () => {}),
      mockSignOut,
      mockAuth,
    };
  },
);

vi.mock("firebase/auth", () => ({
  getAuth: () => mockAuth,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  onIdTokenChanged: mockOnIdTokenChanged,
}));

import { HuckleberryAuth } from "../auth/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUser(uid: string, expiresInMs = 3600_000) {
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  return {
    uid,
    getIdToken: vi.fn().mockResolvedValue("id-token-" + uid),
    getIdTokenResult: vi.fn().mockResolvedValue({ expirationTime: expiresAt }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("HuckleberryAuth", () => {
  let hbAuth: InstanceType<typeof HuckleberryAuth>;

  beforeEach(() => {
    vi.clearAllMocks();
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

    const refreshSpy = vi.spyOn(hbAuth, "refreshSessionToken");
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
    user.getIdToken.mockResolvedValueOnce(refreshedToken);

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
    user.getIdToken.mockResolvedValueOnce(newToken);

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
