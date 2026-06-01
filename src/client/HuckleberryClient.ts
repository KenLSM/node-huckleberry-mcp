import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  type Firestore,
  type DocumentReference,
  type DocumentData,
  type WithFieldValue,
  type UpdateData,
} from "firebase/firestore";
import { FIREBASE_CONFIG } from "../config.js";
import { HuckleberryAuth, type AuthCredentials, type AuthSession } from "../auth/index.js";

export interface HuckleberryClientOptions {
  credentials: AuthCredentials;
}

/**
 * Base client that owns the Firebase app, auth, and Firestore handle.
 * Higher-level operation modules (sleep, feed, etc.) receive an instance of
 * this class so they share a single authenticated connection.
 */
/** Named Firebase app so we never collide with a host's default app. */
const FIREBASE_APP_NAME = "huckleberry";

export class HuckleberryClient {
  private app: FirebaseApp;
  private auth: HuckleberryAuth;
  private db: Firestore;
  private credentials: AuthCredentials;
  /** In-flight initial authentication, shared by concurrent connect() calls. */
  private connecting: Promise<AuthSession> | null = null;

  constructor(options: HuckleberryClientOptions) {
    this.credentials = options.credentials;
    // initializeApp() throws app/duplicate-app if called twice for the same
    // name, so reuse the named app when it already exists.
    this.app = getApps().some((a) => a.name === FIREBASE_APP_NAME)
      ? getApp(FIREBASE_APP_NAME)
      : initializeApp(FIREBASE_CONFIG, FIREBASE_APP_NAME);
    this.auth = new HuckleberryAuth(this.app);
    this.db = getFirestore(this.app);
  }

  /**
   * Authenticates (or re-uses the existing session) and returns it. All
   * operation methods call this to guarantee a valid token before touching
   * Firestore. Concurrent first-time callers share a single sign-in.
   */
  async connect(): Promise<AuthSession> {
    const existing = this.auth.getSession();
    if (existing) {
      return this.auth.ensureSession();
    }
    if (!this.connecting) {
      this.connecting = this.auth.authenticate(this.credentials).finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  /** Returns the current uid, authenticating first if needed. */
  async getUid(): Promise<string> {
    const session = await this.connect();
    return session.uid;
  }

  // ── Firestore read/write helpers ──────────────────────────────────────────

  async readDoc<T = DocumentData>(path: string, ...pathSegments: string[]): Promise<T | null> {
    await this.connect();
    const ref = doc(this.db, path, ...pathSegments);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as T) : null;
  }

  async writeDoc<T extends DocumentData>(
    data: WithFieldValue<T>,
    path: string,
    ...pathSegments: string[]
  ): Promise<void> {
    await this.connect();
    const ref = doc(this.db, path, ...pathSegments) as DocumentReference<T>;
    await setDoc(ref, data);
  }

  async mergeDoc<T extends DocumentData>(
    data: Partial<WithFieldValue<T>>,
    path: string,
    ...pathSegments: string[]
  ): Promise<void> {
    await this.connect();
    const ref = doc(this.db, path, ...pathSegments) as DocumentReference<T>;
    await setDoc(ref, data as WithFieldValue<T>, { merge: true });
  }

  async updateDoc<T extends DocumentData>(
    data: UpdateData<T>,
    path: string,
    ...pathSegments: string[]
  ): Promise<void> {
    await this.connect();
    const ref = doc(this.db, path, ...pathSegments) as DocumentReference<T>;
    await updateDoc(ref, data);
  }

  async deleteDoc(path: string, ...pathSegments: string[]): Promise<void> {
    await this.connect();
    const ref = doc(this.db, path, ...pathSegments);
    await deleteDoc(ref);
  }

  /**
   * Adds a new document to a collection, returning the generated id.
   */
  async addToCollection<T extends DocumentData>(
    data: WithFieldValue<T>,
    collectionPath: string,
    ...collectionSegments: string[]
  ): Promise<string> {
    await this.connect();
    const col = collection(this.db, collectionPath, ...collectionSegments);
    const ref = await addDoc(col, data);
    return ref.id;
  }

  /** Exposes the raw Firestore instance for advanced queries (e.g. onSnapshot). */
  getFirestore(): Firestore {
    return this.db;
  }

  /** Exposes the auth module for direct use by the MCP auth-wiring layer. */
  getAuth(): HuckleberryAuth {
    return this.auth;
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
