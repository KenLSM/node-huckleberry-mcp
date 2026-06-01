import {
  getAuth,
  signInWithEmailAndPassword,
  onIdTokenChanged,
  type Auth,
  type User,
} from "firebase/auth";
import type { FirebaseApp } from "firebase/app";

export interface AuthSession {
  uid: string;
  idToken: string;
  /** Epoch ms when the current ID token expires. */
  expiresAt: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export class HuckleberryAuth {
  private auth: Auth;
  private session: AuthSession | null = null;
  private tokenRefreshUnsubscribe: (() => void) | null = null;

  constructor(app: FirebaseApp) {
    this.auth = getAuth(app);
  }

  /**
   * Sign in with email + password. Stores the resulting session and wires up
   * automatic token refresh via the Firebase SDK's onIdTokenChanged listener.
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthSession> {
    const cred = await signInWithEmailAndPassword(
      this.auth,
      credentials.email,
      credentials.password,
    );
    this.session = await this.sessionFromUser(cred.user);
    this.startTokenListener();
    return this.session;
  }

  /**
   * Returns the current session if the token is still valid (with a 5-minute
   * margin). Automatically refreshes the token when it is near expiry.
   */
  async ensureSession(): Promise<AuthSession> {
    if (!this.session) {
      throw new Error("Not authenticated. Call authenticate() before using the client.");
    }
    if (this.isTokenExpiringSoon()) {
      await this.refreshSessionToken();
    }
    return this.session;
  }

  /**
   * Forces a token refresh and updates the stored session. The Firebase SDK
   * handles the underlying secure-token exchange.
   */
  async refreshSessionToken(): Promise<AuthSession> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error("Cannot refresh — no authenticated user.");
    }
    // forceRefresh=true bypasses the SDK's local cache
    const idToken = await user.getIdToken(true);
    const result = await user.getIdTokenResult();
    this.session = {
      uid: user.uid,
      idToken,
      expiresAt: new Date(result.expirationTime).getTime(),
    };
    return this.session;
  }

  /** Returns the current session without any refresh check, or null. */
  getSession(): AuthSession | null {
    return this.session;
  }

  /** Signs out and clears the stored session. */
  async signOut(): Promise<void> {
    this.stopTokenListener();
    this.session = null;
    await this.auth.signOut();
  }

  private isTokenExpiringSoon(): boolean {
    if (!this.session) return false;
    const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;
    return Date.now() >= this.session.expiresAt - TOKEN_EXPIRY_MARGIN_MS;
  }

  private async sessionFromUser(user: User): Promise<AuthSession> {
    const idToken = await user.getIdToken();
    const result = await user.getIdTokenResult();
    return {
      uid: user.uid,
      idToken,
      expiresAt: new Date(result.expirationTime).getTime(),
    };
  }

  /**
   * Listens to Firebase SDK token changes (auto-refresh, sign-out, etc.) and
   * keeps this.session in sync.
   */
  private startTokenListener(): void {
    this.stopTokenListener();
    this.tokenRefreshUnsubscribe = onIdTokenChanged(this.auth, async (user) => {
      if (user) {
        this.session = await this.sessionFromUser(user);
      } else {
        this.session = null;
      }
    });
  }

  private stopTokenListener(): void {
    if (this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
    }
  }
}
