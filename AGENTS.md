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
TASKS.md             # the roadmap — the source of truth for what to build & in what order
docs/architecture.md # T0.2 findings: auth/data mechanism, config, schema, toolchain
spike/               # throwaway T0.2 validation script (not the real client)
src/
  config.ts          # public Firebase client config
  auth/              # HuckleberryAuth — sign-in + token refresh (T1.1)
  client/            # HuckleberryClient — Firestore read/write base (T1.2)
  __tests__/         # Vitest unit tests
  index.ts           # entry point (MCP server bootstrap lands here in T2.1)
```

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
