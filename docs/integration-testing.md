# Integration testing & schema inspection (T3.2)

The unit tests mock Firebase, so they verify wiring but **not** that documents
match Huckleberry's real Firestore schema. This harness closes that gap by
running against a real account. It is skipped in CI (no credentials).

> ⚠️ These hit a **real account**. The inspector and the default integration
> suite are read-only. The write round-trip suite (§3, opt-in via
> `HUCKLEBERRY_ALLOW_WRITES=1`) creates and deletes real entries — use a
> test/sandbox account.

## Credentials

```bash
export HUCKLEBERRY_EMAIL='you@example.com'
export HUCKLEBERRY_PASSWORD='…'
# optional, to inspect a specific child instead of the default (lastChild):
export CHILD_UID='…'
```

Never commit these. `.env` is gitignored.

## 1. Inspect the real schema (`npm run inspect:schema`)

Logs into a real account and **probes a set of Firestore paths**, reporting which
exist and dumping their document shapes — the empirical map behind
`docs/discovery-plan.md`. By default it probes the verified trackers
(`sleep`, `feed`, `diaper`, `pump`, `health`, plus `users`/`childs`/`types`) **and**
a set of candidate paths we haven't confirmed yet. Numbers and Firestore
`Timestamp`s are annotated (`{ __number }` / `{ __Timestamp }`) so value types are
unambiguous, and a **probe summary** lists doc✓/✗ + subcollection counts and the
`mode`/`type` discriminator values seen per collection.

```bash
npm run inspect:schema
```

Options (env):

| Var           | Effect                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHILD_UID`   | Inspect a specific child (default: `lastChild` / first child).                                                                                           |
| `PROBE_PATHS` | Extra probe specs, comma-separated — `doc` or `doc:sub` with `{cid}`/`{uid}` (e.g. `medication/{cid}:entries`).                                          |
| `ONLY_PROBES` | `1` to probe **only** `PROBE_PATHS` (skip the built-ins).                                                                                                |
| `SAMPLE`      | Max sample entries per subcollection (default 8).                                                                                                        |
| `OUT`         | Machine-readable JSON output path (default `schema-dump.json`; `-` to skip). The dump may contain personal data — it is **gitignored**; don't commit it. |

This is the **ground truth** used to port `src/models/*` and `src/client/*Ops.ts`
to the real schema, and to confirm candidates in `docs/firestore-schema.md`. Paste
its output (or the JSON) into the porting task.

> A candidate path probing **empty/absent** is **not** proof the feature doesn't
> exist — it may live under a different path or inside `health/{cid}/data` behind a
> `mode`. Confirm the real path before trusting.

### Running it via GitHub Actions instead

If you'd rather not run it locally, the **Inspect Schema** workflow
(`.github/workflows/inspect-schema.yml`) runs the same script in CI using the
`HUCKLEBERRY_EMAIL` / `HUCKLEBERRY_PASSWORD` repository secrets. Trigger it from
the Actions tab (Run workflow → pick the branch); the dump appears in the run
**summary** and as the `schema-output` artifact. The "Run workflow" button only
appears once the workflow exists on the repository's default branch.

## 2. Live integration suite (`npm run test:integration`)

Runs `src/__tests__/live.integration.test.ts` against the account. Without
credentials it reports the tests as skipped (so `npm test` and CI stay green).

```bash
npm run test:integration
```

Covers: auth + user/child reads, plus **schema read-back** — it reads the latest
entries for each tracker (sleep, feed, diaper, pump) and parses them with the
ported Zod models. A parse failure means the model is wrong for real data. These
need at least one entry per tracker logged in the app (empty trackers pass
trivially). Read-only — no test data is written to the account.

## 3. Live write round-trip (`HUCKLEBERRY_ALLOW_WRITES=1`)

`src/__tests__/live.integration.write.test.ts` proves that the `log_*` ops
actually land in production. For each tracker it **writes** a real entry, reads
it back to confirm it persisted, then **deletes** it (exercising the delete
path) so the account is left clean.

Because it mutates the account it is **double-gated**: it needs credentials
**and** an explicit `HUCKLEBERRY_ALLOW_WRITES=1` opt-in, so it never runs from
`npm test`, CI, or the read-only `test:integration` invocation above.

> ⚠️ Run against a **test/sandbox account only.** Each `log*` op returns the new
> doc id, so cleanup is deterministic and runs even if an assertion fails. The
> write does bump the parent `prefs.last*` summary, which is left as-is
> (harmless — it just reflects the most recent entry). Growth measurements are
> included.

```bash
HUCKLEBERRY_EMAIL=… HUCKLEBERRY_PASSWORD=… HUCKLEBERRY_ALLOW_WRITES=1 \
  npm run test:integration
```

### Running it via GitHub Actions instead

The **Live Integration** workflow (`.github/workflows/live-integration.yml`)
runs the same `test:integration` job with the repo secrets. By default it is
read-only; tick the **allow_writes** input when dispatching it to also run this
write round-trip (it sets `HUCKLEBERRY_ALLOW_WRITES=1` for that run). Point the
secrets at a test account before enabling writes.
