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

## 2. Live integration suite (`npm run test:integration`)

Runs `src/__tests__/live.integration.test.ts` against the account. Without
credentials it reports the tests as skipped (so `npm test` and CI stay green).

```bash
npm run test:integration
```

Currently read-only (auth + user/child reads). As each tracker's ops are ported
to the verified schema, a write→read-back round-trip is added here so the real
document shape is asserted end-to-end.
