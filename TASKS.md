# node-huckleberry-mcp — Task List

Goal: build a **Node (TypeScript) MCP server for Huckleberry**, porting the
Python stack:

- [`Woyken/py-huckleberry-api`](https://github.com/Woyken/py-huckleberry-api) — Firebase Auth + Firestore (gRPC/HTTP2 + Protobuf) API client.
- [`bckenstler/py-huckleberry-mcp`](https://github.com/bckenstler/py-huckleberry-mcp) — FastMCP server exposing 22 tools across 5 categories.

> **Licensing status (checked 2026-06-01):** both source repos are **MIT-licensed** —
> `py-huckleberry-api` © 2025 Woyken; `py-huckleberry-mcp` © 2026 Huckleberry MCP Contributors.
> MIT permits derivative works and commercial use; the only obligation is to
> reproduce each project's license text and copyright notice in our
> distribution. No licensing blockers — see **T3.7**.

A Node port should mirror that two-layer split:

| Layer      | Python                                        | Node equivalent                                    |
| ---------- | --------------------------------------------- | -------------------------------------------------- |
| API client | `py-huckleberry-api` (Firebase SDK, Pydantic) | `firebase` JS SDK / `@google-cloud/firestore`, Zod |
| MCP server | `py-huckleberry-mcp` (FastMCP)                | `@modelcontextprotocol/sdk` (official TS SDK)      |

Each task below is scoped to be picked up independently by a human **or** an
agent, and carries an acceptance criterion plus a **recommended model** chosen
to optimise cost (see [Model strategy](#model-strategy)).

---

## Model strategy

Match model capability to task difficulty so spend tracks value:

| Model                                | Use for                                                                                               | Rationale                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Haiku 4.5** (`claude-haiku-4-5`)   | Mechanical, fully-specified work: scaffolding, config, boilerplate, docs, straight model/type porting | Cheapest & fastest; these tasks have little ambiguity              |
| **Sonnet 4.6** (`claude-sonnet-4-6`) | Most implementation: client ops, MCP tool wiring, tests                                               | Strong coding at mid cost — the workhorse tier                     |
| **Opus 4.8** (`claude-opus-4-8`)     | High-risk / ambiguous design: the Firestore-access spike, architecture calls, reverse-engineering     | Reserve the priciest tier for where capability changes the outcome |

Rules of thumb:

- **Start a hard task on Opus only if a Sonnet attempt stalls** — or if it is flagged ⚠️ below.
- Keep humans in the loop on ⚠️ tasks regardless of model.
- Docs/config tasks rarely justify above Haiku.

---

## Phase 0 — Foundation & scaffolding

| ID          | Task                                                                                                                                                                                                                                                                                                                    | Acceptance criterion                                                                                                                                                                                                                                                  | Model        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **T0.1** ✅ | Repo scaffolding & tooling: TS project, `package.json`, `tsconfig.json`, **oxc (oxlint + oxfmt) + Vitest**, `src/`/`dist/`, `.gitignore`, `.env.example` (`HUCKLEBERRY_EMAIL`, `HUCKLEBERRY_PASSWORD`, `HUCKLEBERRY_TIMEZONE`)                                                                                          | **DONE** — `npm run build`, `npm run lint`, `npm run format:check`, `npm test` all green. Toolchain documented in AGENTS.md + `docs/architecture.md`                                                                                                                  | Haiku 4.5    |
| **T0.2** ✅ | **Firestore client strategy spike** (highest risk, do first): confirm which Node lib replicates the Python gRPC/Firestore path (`firebase` JS SDK vs `@google-cloud/firestore` vs Admin SDK); verify email/pw auth (Identity Toolkit `signInWithPassword`) and authenticated reads work against the real project config | **DONE & live-verified** — decision: **Firebase JS SDK**. Auth + authenticated `users/{uid}` read confirmed against a real account; raw REST ruled out (`ACCESS_TOKEN_TYPE_UNSUPPORTED`); child-list schema captured (`childList[].cid`). See `docs/architecture.md`. | **Opus 4.8** |
| **T0.3** ✅ | CI pipeline: GitHub Actions for lint, format:check, build, unit tests on PR + push                                                                                                                                                                                                                                      | **DONE** — `.github/workflows/ci.yml` runs lint + format:check + build + test on Node 24 for pushes/PRs to `main` and `claude/**`                                                                                                                                     | Haiku 4.5    |

---

## Phase 1 — API client library (`huckleberry-api` equivalent)

> ✅ **Schema port complete & live-verified.** The models + write ops were ported
> to the real Firestore schema (epoch-second floats, timezone `offset`, parent
> `prefs` summaries, correct collections) and verified against a real account: all
> tracker **reads** parse live data (the gated `live-integration` workflow is green)
> and a **write** round-trip (`log_*`) was confirmed in the Huckleberry app. Read
> models are intentionally **lenient** (no enums on backend-controlled values,
> `.passthrough()`) so real-data variance never breaks parsing; the write tools
> keep their own strict input validation. Schema reference: `docs/architecture.md`
> → "Verified Firestore tracker schema". Remaining Phase 1 item: T1.10 (optional
> real-time listeners). Sleep active-session timer ops (`start/pause/resume/
complete_sleep`) are deferred — only `log_sleep` is implemented.

| ID          | Task                                                                                                                             | Acceptance criterion                                                                                                                                                                                           | Model      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **T1.1** ✅ | Auth module: `authenticate()`, `ensureSession()`, `refreshSessionToken()` with auto-refresh                                      | **DONE** — `src/auth/auth.ts` (`HuckleberryAuth`), SDK-managed refresh, unit-tested                                                                                                                            | Sonnet 4.6 |
| **T1.2** ✅ | Firestore connection + base `HuckleberryClient` class (auth + Firestore handle, read/write helpers)                              | **DONE** — `src/client/HuckleberryClient.ts`, generic read/write/merge/update/delete/add helpers, unit-tested                                                                                                  | Sonnet 4.6 |
| **T1.3** ✅ | Data models: port `firebase_types.py` to Zod/TS (child, sleep, feed, health, growth, solids)                                     | **DONE** — `src/models/index.ts`; all types compile; Timestamp coercion tested via sleepOps tests                                                                                                              | Haiku 4.5  |
| **T1.4** ✅ | Child reads: `getUser()`, `getChild(childUid)`, multi-child support                                                              | **DONE** — `src/client/childOps.ts`; `getUser`, `getChild`, `getChildren`, `getDefaultChildUid`, unit-tested                                                                                                   | Sonnet 4.6 |
| **T1.5** ✅ | Sleep ops: `start/pause/resume/cancel/complete/log` + history                                                                    | **DONE** — `src/client/sleepOps.ts`; all 6 write ops + `getSleepHistory`, unit-tested                                                                                                                          | Haiku 4.5  |
| **T1.6** ✅ | Feeding ops: nursing `start/pause/resume/switchSide/complete/log`, `logBottle`, `logPump`, `listPumpIntervals`                   | **DONE** — `src/client/feedOps.ts`; all 9 ops + `getFeedHistory`, unit-tested                                                                                                                                  | Haiku 4.5  |
| **T1.7** ✅ | Diaper & potty: `logDiaper` (pee/poo/both/dry + color/consistency), `logPotty`                                                   | **DONE** — `src/client/healthOps.ts`; `logDiaper` + `logPotty`, unit-tested                                                                                                                                    | Haiku 4.5  |
| **T1.8** ✅ | Growth: `logGrowth` (weight/height/head circ., metric/imperial), `getLatestGrowth`                                               | **DONE** — `src/client/growthOps.ts` writes `health/{cid}/data` (no prefs, per live), `logGrowth`/`getLatestGrowth`/`getGrowthHistory`; 3 MCP tools registered; unit-tested (body + no-prefs) + live read-back | Haiku 4.5  |
| **T1.9** ✅ | Solids: `listCuratedFoods`, `listCustomFoods`, `createCustomFood`, `logSolids`                                                   | **DONE** — `src/client/solidsOps.ts`; Cloud Storage fetch + Firestore custom foods + logSolids, unit-tested                                                                                                    | Haiku 4.5  |
| **T1.10**   | _(Optional)_ Real-time listeners: `setupSleepListener`, `setupFeedListener`, `setupHealthListener` — defer unless MCP needs them | Listener fires on a live doc change                                                                                                                                                                            | Sonnet 4.6 |

> T1.1–T1.4 are prerequisites; T1.5–T1.9 are parallelizable.

---

## Phase 2 — MCP server layer

| ID          | Task                                                                                                                                   | Acceptance criterion                                                                                                                                            | Model      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **T2.1** ✅ | MCP server bootstrap: stdio server with `@modelcontextprotocol/sdk`, tool-registration helper, schema-from-Zod, central error handling | **DONE** — `src/server/server.ts` (`createServer`, `registerTool`, Zod→JSON Schema), `src/server/errors.ts` (`toErrorResult`, `withErrorHandling`), unit-tested | Sonnet 4.6 |
| **T2.2** ✅ | Lazy authentication wiring: creds from env, validated on first tool call                                                               | **DONE** — `src/server/auth.ts` (`getClient` singleton from env); missing-creds error tested                                                                    | Sonnet 4.6 |
| **T2.3** ✅ | Tools: Child Management (2)                                                                                                            | Tools invoke T1.4 client, return structured results                                                                                                             | Haiku 4.5  |
| **T2.4** ✅ | Tools: Sleep (7)                                                                                                                       | Tools invoke T1.5 client                                                                                                                                        | Haiku 4.5  |
| **T2.5** ✅ | Tools: Feeding (8)                                                                                                                     | Tools invoke T1.6 client                                                                                                                                        | Haiku 4.5  |
| **T2.6** ✅ | Tools: Diaper (2)                                                                                                                      | Tools invoke T1.7 client                                                                                                                                        | Haiku 4.5  |
| **T2.7** ✅ | Tools: Growth (3)                                                                                                                      | Tools invoke T1.8 client                                                                                                                                        | Haiku 4.5  |
| **T2.8** ✅ | _(Optional)_ Tools: Solids — parity beyond the original 22                                                                             | Tools invoke T1.9 client                                                                                                                                        | Haiku 4.5  |

> Phase 2 tool tasks are thin wrappers over Phase 1 — once T2.1/T2.2 set the
> pattern, the per-category tasks are mechanical (Haiku-tier).

---

## Phase 3 — Quality, packaging, docs

| ID          | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Acceptance criterion                                                                                                            | Model      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **T3.1** ✅ | Unit tests for client logic with Firestore mocked                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Coverage of core paths; CI runs them                                                                                            | Sonnet 4.6 |
| **T3.2** ✅ | Integration test suite + guide (port `tests/README.md`), gated behind real creds, skipped in CI by default                                                                                                                                                                                                                                                                                                                                                                                                       | Suite runs locally against a real/sandbox account                                                                               | Sonnet 4.6 |
| **T3.3** ✅ | MCP smoke test via MCP Inspector / scripted client listing & calling each tool                                                                                                                                                                                                                                                                                                                                                                                                                                   | Every tool lists and returns without crashing                                                                                   | Haiku 4.5  |
| **T3.4** ✅ | README: install, env config, Claude Desktop `mcpServers` snippet, tool catalog                                                                                                                                                                                                                                                                                                                                                                                                                                   | A new user can configure & run from the README alone                                                                            | Haiku 4.5  |
| **T3.5** ✅ | npm packaging: `bin` for `npx`, publish workflow, semver                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `npx node-huckleberry-mcp` launches the server; `.github/workflows/npm-publish.yml` publishes tagged releases to npm            | Haiku 4.5  |
| **T3.6** ✅ | Contributor guide for humans & agents: **`AGENTS.md`** (canonical) + `CLAUDE.md` pointer — architecture, conventions, how to pick up tasks, secrets/safety                                                                                                                                                                                                                                                                                                                                                       | Present and accurate; kept in sync as the codebase grows                                                                        | Haiku 4.5  |
| **T3.7** ✅ | **Attribution & license compliance**: this port lifts most of its design/behavior from the two MIT source repos, so credit them properly. (a) Add a `LICENSE` (MIT) for this project; (b) add a `NOTICE`/`THIRD-PARTY` file or README "Credits" section reproducing the MIT text + copyright lines for `py-huckleberry-api` (© 2025 Woyken) and `py-huckleberry-mcp` (© 2026 Huckleberry MCP Contributors), with links; (c) credit both prominently at the top of the README as the upstream this is ported from | Both upstream MIT notices + copyrights are reproduced and linked; README clearly states this is a Node port of the two projects | Haiku 4.5  |

---

## Backlog / enhancements (not yet scheduled)

| ID  | Task                                                                                                                                                | Notes                                                                                                                                                                                              | Model      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| B1  | Add optional `notes` to the remaining `log_*` tools (`log_nursing`, `log_solids`, `log_pump`, `log_diaper`, `log_potty`, `log_sleep`, `log_growth`) | The Python `firebase_types.py` has a `notes: str` field on every interval. Mirror the `log_bottle` change: thread `notes?` through each op + tool, write only when provided, add a unit assertion. | Haiku 4.5  |
| B2  | `edit_*` tools for the other trackers (sleep, diaper, pump, growth) + expose the doc `id` in their history reads                                    | Follow the `edit_feed` / `getFeedHistory`-returns-`id` pattern.                                                                                                                                    | Haiku 4.5  |
| B3  | `delete_*` (or `cancel_*`) tools to remove a logged entry                                                                                           | `deleteDoc` on `{collection}/{cid}/{sub}/{id}`; decide whether to also clear the matching `prefs.last*`.                                                                                           | Sonnet 4.6 |
| B4  | T1.10 — real-time listeners via `onSnapshot` (optional)                                                                                             | Maps cleanly to the SDK; only if a use case needs live updates.                                                                                                                                    | Sonnet 4.6 |

## Sequencing & risk notes

1. **T0.2 is the linchpin** — the project depends on Node replicating the
   gRPC/Firestore auth path. Validate it (on Opus) before committing to the rest.
2. Phases 1 → 2 are layered: build the client first, wrap it in MCP second.
3. Real-time listeners (T1.10) and Solids MCP tools (T2.8) are stretch — the
   original MCP ships 22 tools without exposing them.

## Cost summary

- **~1 Opus task** (T0.2) — the one place capability decides success.
- **~12 Sonnet tasks** — the implementation core.
- **~13 Haiku tasks** — scaffolding, thin tool wrappers, docs, config, attribution.

Pushing routine work down to Haiku and reserving Opus for the single
high-uncertainty spike keeps the bulk of spend in the mid tier where it earns
its keep.
