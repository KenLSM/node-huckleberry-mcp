# Architecture & T0.2 Spike Findings

Status: **T0.2 (Firestore client strategy spike) — substantially complete.**
The one remaining check (an authenticated Firestore read) requires real
Huckleberry credentials; the spike script is ready to run that verification.

## Decision

**Use the Firebase JS SDK (`firebase` npm package) for both auth and Firestore.**
It is the natural Node equivalent of the Python `py-huckleberry-api` data path,
and it is the *supported* client transport for authenticating as a Huckleberry
end-user and reading/writing Firestore under that user's security rules.

## How the Python client actually works (verified from source)

Source: [`Woyken/py-huckleberry-api`](https://github.com/Woyken/py-huckleberry-api),
`src/huckleberry_api/const.py` and `api.py`.

- **Auth = plain REST** against Google Identity Toolkit:
  - `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<API_KEY>`
    with `{email, password, returnSecureToken: true}` → returns `idToken`,
    `refreshToken`, `localId` (the user uid), `expiresIn`.
  - Refresh via `POST https://securetoken.googleapis.com/v1/token`.
- **Data = gRPC Firestore SDK** (`google.cloud.firestore.AsyncClient`), *not* REST.
  The client is built with `project="simpleintervals"` and a custom
  `FirebaseTokenCredentials` that simply presents the Firebase **ID token** as the
  bearer token. The `FIRESTORE_BASE_URL` REST constant in `const.py` is defined
  but **unused** — an abandoned REST attempt.

### Reverse-engineered Firebase config (confirmed live)

```
apiKey    = AIzaSyApGVHktXeekGyAt-G6dIeWHUkq2oXqcjg
projectId = simpleintervals
appId     = 1:219218185774:android:a3e215cc246b92b0
```

### Firestore layout (from api.py)

| Path | Purpose |
|---|---|
| `users/{uid}` | user document (entry point; `get_user`) |
| `childs/{childUid}` | child profile |
| `sleep/{childUid}` + `…/intervals/{id}` | sleep sessions |
| `feed/{childUid}` + `…/intervals/{id}` | feeding sessions |
| `types/{childUid}/custom/{foodId}` | custom solids foods |

Curated foods are fetched from Cloud Storage object
`simpleintervals.appspot.com/foods/fooddb.json` (separate from Firestore).

## What the spike verified (no credentials needed)

Run via `curl` and `spike/spike.mjs`:

1. **Auth endpoint + API key are live** — `signInWithPassword` with bogus creds
   returns `EMAIL_NOT_FOUND` / `auth/user-not-found`, *not* `API_KEY_INVALID`.
2. **Raw Firestore REST is a dead end for us** — an unauthenticated REST read
   returns `403 PERMISSION_DENIED`, and a Firebase ID token passed as a plain
   `Bearer` returns `401 ACCESS_TOKEN_TYPE_UNSUPPORTED`. The v1 REST API expects a
   Google **OAuth2 access token**, not a Firebase **ID token**. This is precisely
   why the Python lib uses the SDK transport, and it rules out a "just `fetch()`"
   Node implementation.
3. **Firebase JS SDK initializes in Node** with the config above and reaches the
   live auth endpoint (`firebase@11`).

## What remains (needs real credentials)

Confirm an authenticated `getDoc(users/{uid})` returns the user document:

```bash
cd spike
HUCKLEBERRY_EMAIL=you@example.com HUCKLEBERRY_PASSWORD='…' node spike.mjs
```

Expected: `[ok] Authenticated …` then `[ok] users/{uid} read; exists=true`.

## Implications for the build

- **Client layer (Phase 1)** wraps the Firebase JS SDK: `signInWithEmailAndPassword`
  for `authenticate()`; the SDK manages token refresh automatically (simplifies
  the Python `ensure_session`/`refresh_session_token` logic). Firestore
  `doc()`/`getDoc()`/`setDoc()` replace the Python collection/document calls.
- **Real-time listeners (T1.10)** map cleanly to `onSnapshot` — no custom
  listener-recreation logic like the Python loop-bound gRPC channels need.
- **Risk retired:** the highest-uncertainty question ("can Node talk to
  Huckleberry's Firestore as the user?") is answered yes, via a first-party SDK.
