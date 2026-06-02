# Integration testing & schema inspection (T3.2)

The unit tests mock Firebase, so they verify wiring but **not** that documents
match Huckleberry's real Firestore schema. This harness closes that gap by
running against a real account. It is skipped in CI (no credentials).

> ⚠️ These hit a **real account**. The inspector is read-only. Write round-trips
> (added as ops are ported) create real entries — use a test/sandbox child.

## Credentials

```bash
export HUCKLEBERRY_EMAIL='you@example.com'
export HUCKLEBERRY_PASSWORD='…'
# optional, to inspect a specific child instead of the default (lastChild):
export CHILD_UID='…'
```

Never commit these. `.env` is gitignored.

## 1. Inspect the real schema (`npm run inspect:schema`)

Dumps the raw Firestore document shapes for every tracker
(`sleep`, `feed`, `diaper`, `pump`, `health`) for one child — parent `prefs`
summaries plus a few sample interval/`data` entries. Numbers and Firestore
`Timestamp`s are annotated (`{ __number }` / `{ __Timestamp }`) so value types
are unambiguous.

```bash
npm run inspect:schema
```

This is the **ground truth** used to port `src/models/*` and `src/client/*Ops.ts`
to the real schema. Paste its output into the porting task.

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
