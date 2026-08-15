# AGENTS.md

Guidance for humans and AI agents working in this repo. This is the canonical
contributor guide; `CLAUDE.md` points here.

## What this project is

A **Node (TypeScript) MCP server for Huckleberry** (the baby-tracking app),
ported from two MIT-licensed Python projects:

- [`Woyken/py-huckleberry-api`](https://github.com/Woyken/py-huckleberry-api) — Firebase Auth + Firestore client.
- [`bckenstler/py-huckleberry-mcp`](https://github.com/bckenstler/py-huckleberry-mcp) — FastMCP server (22 tools, 5 categories).

Most design/behavior is lifted from these; credit them (see **T3.7** in `TASKS.md`).

## Architecture (two layers — keep them separate)

| Layer      | What                          | Node choice                                                            |
| ---------- | ----------------------------- | ---------------------------------------------------------------------- |
| API client | Auth + Firestore reads/writes | **Firebase JS SDK** (`firebase` npm) — decided & live-verified in T0.2 |
| MCP server | Exposes tools over MCP        | `@modelcontextprotocol/sdk` (official TS SDK)                          |

Read **`docs/architecture.md`** before touching the client layer — it has the
verified auth mechanism, the live Firebase config, the Firestore collection
layout, and the child-resolution schema (`childList[].cid`). Key facts:

- Auth: Firebase email/password (`signInWithEmailAndPassword`); the SDK handles
  token refresh automatically.
- Data: Firestore via the SDK. **Raw Firestore REST does not work** for us
  (Firebase ID tokens are rejected with `ACCESS_TOKEN_TYPE_UNSUPPORTED`) — don't
  try to replace the SDK with bare `fetch()`.

## Repo layout

```
TASKS.md                  # the roadmap / status
docs/architecture.md      # auth + data mechanism, live-verified Firestore schema, toolchain
docs/schema-port-spec.md  # exact build-to spec for the client ops/models
docs/integration-testing.md # how to run the gated live suite + schema inspector
scripts/inspect-schema.mjs  # dumps real Firestore shapes (needs creds) — ground truth
.github/workflows/        # ci.yml (Node 24), inspect-schema.yml, live-integration.yml
src/
  config.ts        # public Firebase client config + TOKEN_EXPIRY_MARGIN_MS
  util/timezone.ts # huckleberryOffsetMinutes() — the `offset` field
  auth/            # HuckleberryAuth — sign-in + SDK-managed refresh
  client/          # HuckleberryClient (base) + prefs.ts helper + *Ops.ts per tracker
  models/          # Zod schemas per document type
  server/          # MCP server bootstrap, lazy auth (getClient), error handling
  tools/           # MCP tool registrations (29 tools), imported by index.ts
  __tests__/       # Vitest unit tests + gated live.integration.test.ts
  index.ts         # entry point: registers tools, starts the stdio MCP server
```

## Schema & data conventions (live-verified)

- Firestore stores **epoch-second number** timestamps (`start`, `lastUpdated`),
  `duration` in seconds, and `offset` = negated tz minutes (UTC+8 → `-480`, via
  `util/timezone.ts`). **Never** write Firestore `Timestamp` objects.
- Each tracker is `{collection}/{cid}` with entries in a subcollection
  (`intervals`, or `data` for growth) **plus** a parent `prefs` summary updated on
  every write (`client/prefs.ts` `writeIntervalWithPrefs`). Growth is the
  exception — it does **not** update `prefs`.
- **Read models are deliberately lenient**: no enums on backend-controlled values
  (modes, units), only truly-always-present fields required, `.passthrough()` for
  unknowns. Over-constraining read models has repeatedly broken on real data
  (gender, diaper quantity). The **write tools** keep strict input validation.
- Ground-truth the schema with `npm run inspect:schema`; validate parsing with
  `npm run test:integration` (both gated on `HUCKLEBERRY_*` creds). Don't invent
  fields — if unsure, inspect a real document.
- **We deviate from the Python reference on purpose.** Treat `py-huckleberry-api`
  /`py-huckleberry-mcp` as leads, not a spec — they are reverse-engineered and can
  be wrong/stale. For any new feature, verify the real Firestore/API behavior
  ourselves (act in app → `inspect:schema` → build to the observed shape → prove
  with a gated live round-trip) and follow the backend where it disagrees with the
  port. See `docs/discovery-plan.md` for the mapping method and `TASKS.md` → B5 for
  a confirmed deviation (solids food tracking).

## How to pick up work

1. **Start from `TASKS.md`.** Tasks are phased (T0.x → T3.x) with IDs, acceptance
   criteria, and a **recommended model** per task to keep costs sensible. Honor
   the model tiers: Haiku for mechanical work, Sonnet for implementation, Opus
   only for flagged ⚠️ design tasks.
2. Respect dependencies: Phase 1 (client) before Phase 2 (MCP). T1.1–T1.4 gate
   T1.5–T1.9.
3. When a task is done, update its row in `TASKS.md` (mark ✅, note where the
   work landed) in the same change.

## Conventions

- **Language:** TypeScript, ES modules, `async/await`. Source uses NodeNext-style
  explicit `.js` import specifiers (e.g. `import … from "../auth/index.js"`) — keep
  this; the build and Vitest are configured for it. Model the Python `*.py` source
  closely — method names and Firestore paths should be recognizable across the two
  codebases.
- **Validation:** use Zod for Firestore document models (the analog of the
  Python Pydantic `firebase_types.py`).

### Toolchain (established in T0.1)

The project uses the **oxc** stack plus Vitest — **not** ESLint/Prettier/Jest.
Run these before committing; all must be green (these become the T0.3 CI gates):

| Command                | Tool              | Purpose                                                   |
| ---------------------- | ----------------- | --------------------------------------------------------- |
| `npm run build`        | `tsc`             | Type-check + emit to `dist/` (tests excluded from build)  |
| `npm run lint`         | **oxlint**        | Lint (`.oxlintrc.json`)                                   |
| `npm run format`       | **oxfmt**         | Format in place (`.oxfmtrc.json`, printWidth 100)         |
| `npm run format:check` | **oxfmt --check** | Verify formatting                                         |
| `npm test`             | **Vitest**        | Unit tests (`vitest run`); `npm run test:watch` for watch |

Add tests (`*.test.ts` under `src/__tests__/`) alongside new client/tool code.
Vitest mocks ESM via `vi.mock` + `vi.hoisted` (see existing tests for the pattern).

## Secrets & safety

- Credentials come from env vars: `HUCKLEBERRY_EMAIL`, `HUCKLEBERRY_PASSWORD`,
  `HUCKLEBERRY_TIMEZONE`. **Never commit credentials** or a populated `.env`.
- The Firebase **config** (apiKey/projectId/appId) is public client config, not a
  secret — it's fine in source, as it is in the upstream Python repo.
- This is an **unofficial** client of a third-party service; treat the API as
  reverse-engineered and subject to change.

## Git

- Develop on the designated feature branch; commit with clear messages; push
  when changes are complete. Don't open a PR unless asked.

### Branch hygiene — keep branches small and isolated

**One concern per branch, one branch per PR.** A branch should carry a single
task (one `B*`/`T*` item, one bug fix, one doc change) so it can be reviewed,
merged, reverted, and released on its own.

Why it matters here: a branch that bundles three features couples their risk. We
hit exactly that — a 27-file / +1216-line PR mixed tooling, a delete feature, and
an **unverified write shape**, which meant the safe two-thirds couldn't merge
until the risky third was verified. Splitting it into three PRs unblocked both.

Rules of thumb:

- Start a **new branch off `main`** for each task rather than continuing on the
  previous one — it's the default way branches quietly accumulate scope.
- If a branch grows a second concern, **split it** (cherry-pick the commits onto
  fresh branches from `main`) rather than letting it ride along.
- Keep commits concern-scoped too — a clean split is only possible when commits
  don't mix concerns.
- **Never bundle unverified work with verified work.** Anything pending live
  verification (see the verify-first policy above) goes on its own branch, as a
  **draft** PR, so it can't block or silently ship with the rest.
- Prefer a stack (branch B based on A) over one big branch when work genuinely
  depends on earlier work — and say so in the PR description.
- Rough smell test: if you can't describe the branch in one sentence without
  "and", it's probably two branches.
