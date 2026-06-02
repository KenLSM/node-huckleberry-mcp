# Architecture & T0.2 Spike Findings

Status: **T0.2 (Firestore client strategy spike) — COMPLETE.** Auth and an
authenticated `users/{uid}` read were both verified end-to-end against a live
account via the Firebase JS SDK in Node.

## Decision

**Use the Firebase JS SDK (`firebase` npm package) for both auth and Firestore.**
It is the natural Node equivalent of the Python `py-huckleberry-api` data path,
and it is the _supported_ client transport for authenticating as a Huckleberry
end-user and reading/writing Firestore under that user's security rules.

## How the Python client actually works (verified from source)

Source: [`Woyken/py-huckleberry-api`](https://github.com/Woyken/py-huckleberry-api),
`src/huckleberry_api/const.py` and `api.py`.

- **Auth = plain REST** against Google Identity Toolkit:
  - `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<API_KEY>`
    with `{email, password, returnSecureToken: true}` → returns `idToken`,
    `refreshToken`, `localId` (the user uid), `expiresIn`.
  - Refresh via `POST https://securetoken.googleapis.com/v1/token`.
- **Data = gRPC Firestore SDK** (`google.cloud.firestore.AsyncClient`), _not_ REST.
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

| Path                                    | Purpose                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `users/{uid}`                           | user document (entry point; `get_user`). Children are listed here — see below |
| `childs/{childUid}`                     | child profile                                                                 |
| `sleep/{childUid}` + `…/intervals/{id}` | sleep sessions                                                                |
| `feed/{childUid}` + `…/intervals/{id}`  | feeding sessions                                                              |
| `types/{childUid}/custom/{foodId}`      | custom solids foods                                                           |

Curated foods are fetched from Cloud Storage object
`simpleintervals.appspot.com/foods/fooddb.json` (separate from Firestore).

### Child resolution (verified against a live `users/{uid}` doc)

The user document does **not** contain a `childs` map. Child UIDs come from:

- **`childList`** — `list[{ cid, nickname?, picture?, color? }]`. The `cid` is the
  child UID used as the doc id in `childs/{cid}`, `sleep/{cid}`, `feed/{cid}`, etc.
  **This is the authoritative source for "list children" (T1.4).**
- **`hbChilds`** — `map<childUid, { addedAt }>`, parallel to `childList`.
- **`lastChild`** — UID of the most recently active child (good default selection).

Verified live top-level user keys: `childList, hbChilds, lastChild, email,
firstname, lastname, latestTimezone, subscription, installedApps, …`.
(The Python `FirebaseUserDocument` model in `firebase_types.py` matches this.)

## What the spike verified (no credentials needed)

Run via `curl` and `spike/spike.mjs`:

1. **Auth endpoint + API key are live** — `signInWithPassword` with bogus creds
   returns `EMAIL_NOT_FOUND` / `auth/user-not-found`, _not_ `API_KEY_INVALID`.
2. **Raw Firestore REST is a dead end for us** — an unauthenticated REST read
   returns `403 PERMISSION_DENIED`, and a Firebase ID token passed as a plain
   `Bearer` returns `401 ACCESS_TOKEN_TYPE_UNSUPPORTED`. The v1 REST API expects a
   Google **OAuth2 access token**, not a Firebase **ID token**. This is precisely
   why the Python lib uses the SDK transport, and it rules out a "just `fetch()`"
   Node implementation.
3. **Firebase JS SDK initializes in Node** with the config above and reaches the
   live auth endpoint (`firebase@11`).

## Verified with real credentials

`spike/spike.mjs` was run against a live account: authentication succeeded and
`getDoc(users/{uid})` returned the user document (`exists=true`). The child-list
schema above was discovered from that real document. Nothing in T0.2 remains
open.

## Implications for the build

- **Client layer (Phase 1)** wraps the Firebase JS SDK: `signInWithEmailAndPassword`
  for `authenticate()`; the SDK manages token refresh automatically (simplifies
  the Python `ensure_session`/`refresh_session_token` logic). Firestore
  `doc()`/`getDoc()`/`setDoc()` replace the Python collection/document calls.
- **Real-time listeners (T1.10)** map cleanly to `onSnapshot` — no custom
  listener-recreation logic like the Python loop-bound gRPC channels need.
- **Risk retired:** the highest-uncertainty question ("can Node talk to
  Huckleberry's Firestore as the user?") is answered yes, via a first-party SDK.

## Project toolchain (decided in T0.1)

TypeScript throughout, with the **oxc** stack and Vitest — deliberately **not**
ESLint/Prettier/Jest:

- **`tsc`** — build/type-check (`npm run build`), emits to `dist/`; test files are
  excluded from the build.
- **oxlint** (`npm run lint`, `.oxlintrc.json`) — linting.
- **oxfmt** (`npm run format` / `format:check`, `.oxfmtrc.json`, printWidth 100) —
  formatting; respects `.gitignore`.
- **Vitest** (`npm test`) — unit tests in `src/__tests__/`, ESM mocking via
  `vi.mock` + `vi.hoisted`.

Vitest resolves the source's NodeNext-style `.js` import specifiers via a small
alias in `vitest.config.ts` (`/^(\.{1,2}\/.*)\.js$/` → `$1`).

## Verified Firestore tracker schema (live-confirmed 2026-06)

Captured via `npm run inspect:schema` against a real account. **All time values
are plain numbers, not Firestore `Timestamp` objects**: `start`/`lastUpdated` are
epoch **seconds** (float), `duration` is **seconds**, `offset` is timezone
minutes **negated** (UTC+8 → `-480`; see `src/util/timezone.ts`).

Each tracker is `{collection}/{childUid}` (parent doc) with entries in a
subcollection, plus a `prefs` summary on the parent. Doc IDs are Firestore
auto-IDs (`addDoc`).

| Tracker                      | Entry path               | Parent summary                                                    |
| ---------------------------- | ------------------------ | ----------------------------------------------------------------- |
| Sleep                        | `sleep/{cid}/intervals`  | `prefs.lastSleep`                                                 |
| Feed (nursing/bottle/solids) | `feed/{cid}/intervals`   | `prefs.lastFeed`, `prefs.lastSide`, `prefs.bottle*`               |
| Diaper + potty               | `diaper/{cid}/intervals` | `prefs.lastDiaper` / `prefs.lastPotty`                            |
| Pump                         | `pump/{cid}/intervals`   | `prefs.lastPump`                                                  |
| Growth                       | `health/{cid}/data`      | **none** — growth does NOT update parent `prefs` (live-confirmed) |

Confirmed entry shapes (live):

- **Sleep:** `{ start, duration, offset, lastUpdated }`; `prefs.lastSleep = { start, offset, duration }`.
- **Feed / nursing:** `{ mode:"breast", leftDuration, rightDuration, lastSide, start, offset, lastUpdated }`.
- **Feed / bottle:** `{ mode:"bottle", amount, bottleType:"Breast Milk", units:"ml", start, offset, lastUpdated }`.
- **Feed / solids:** `{ mode:"solids", start, offset, lastUpdated }` (+ food refs when present).
- **Diaper:** `{ mode:"poo", color:"yellow", quantity:50, start, offset, lastUpdated }` — `quantity` is a **scalar** (0/50/100 = little/medium/big), _not_ the `{pee,poo}` map the Python source uses. **Live wins.**
- **Pump:** `{ entryMode:"total", leftAmount, rightAmount, duration, units:"oz", start, offset, lastUpdated }`.
- **Growth (`health/{cid}/data`, live-confirmed):** `{ mode:"growth", start, offset, lastUpdated, weight?, weightUnits:"kg", height?, heightUnits:"cm", head?, headUnits:"hcm" }` (metric; imperial units `lbs.oz`/`ft.in`/`hin`). Growth does **not** write a `prefs` summary.

Every parent `prefs` also carries `timestamp:{ seconds:<float> }` and
`local_timestamp:<float>` set to "now" on each write.

> The previously-generated ops (T1.5–T1.9) do **not** match this: they wrote
> Firestore `Timestamp` objects, invented field names (`startTime`/`status`/`date`),
> omitted `offset` + `prefs`, and used 3 wrong collections. They are being ported
> to the shapes above.

## Implementation status

- **T1.1 (auth)** — `src/auth/auth.ts`: `HuckleberryAuth` wraps
  `signInWithEmailAndPassword`; token refresh is delegated to the SDK
  (`onIdTokenChanged` + `getIdToken(true)`), with a 5-minute expiry margin.
- **T1.2 (client)** — `src/client/HuckleberryClient.ts`: owns the Firebase app,
  auth, and Firestore handle; provides `connect()` + generic
  read/write/merge/update/delete/add helpers that operation modules build on.
- Both are covered by Vitest unit tests (firebase mocked).
