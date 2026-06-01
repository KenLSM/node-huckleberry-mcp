import { HuckleberryClient } from "../client/HuckleberryClient.js";

let _client: HuckleberryClient | null = null;

/**
 * T2.2 — Lazy authentication.
 *
 * Credentials are read from env on the first call. Subsequent calls return the
 * same client instance so the Firebase app and auth state are shared across
 * all tool invocations.
 *
 * Throws a clear error if HUCKLEBERRY_EMAIL or HUCKLEBERRY_PASSWORD are unset,
 * so the user sees a useful message before any Firestore call is attempted.
 */
export function getClient(): HuckleberryClient {
  if (_client) return _client;

  const email = process.env.HUCKLEBERRY_EMAIL;
  const password = process.env.HUCKLEBERRY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing credentials: set HUCKLEBERRY_EMAIL and HUCKLEBERRY_PASSWORD environment variables.",
    );
  }

  _client = new HuckleberryClient({ credentials: { email, password } });
  return _client;
}

/** Clears the cached client — used in tests to reset state between runs. */
export function _resetClient(): void {
  _client = null;
}
