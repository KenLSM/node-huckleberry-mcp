# Firestore schema catalog

The living map of Huckleberry's Firestore layout — every collection/document
shape we've **confirmed against a real account**, plus candidates still to
confirm. This is the reconcile-and-record output of `docs/discovery-plan.md`
(Track E). Regenerate evidence with `npm run inspect:schema` (gated on creds);
update this file with anything newly confirmed.

> Conventions (live-confirmed): all time values are **plain numbers, not Firestore
> `Timestamp`** — `start`/`lastUpdated` are epoch **seconds** (float), `duration`
> is **seconds**, `offset` is timezone minutes **negated** (UTC+8 → `-480`). Doc
> IDs are Firestore auto-IDs (`addDoc`). Each tracker is `{collection}/{cid}`
> (parent doc holding a `prefs` summary) with entries in a subcollection.

## Status legend

- ✅ **confirmed** — shape captured from a real document.
- 🟡 **partial** — path confirmed, but some fields/variants not yet captured.
- ❓ **candidate** — guessed (from the app UI or the Python reference); not yet
  probed/confirmed. Probe with `PROBE_PATHS=...` (see the inspector).

## Account / child

| Path           | Status | Shape (key fields)                                                           |
| -------------- | ------ | ---------------------------------------------------------------------------- |
| `users/{uid}`  | ✅     | `{ childList: [{ cid, … }], lastChild, email, … }` — child resolution source |
| `childs/{cid}` | ✅     | `{ childsName, gender ("M"/…), birthdate, … }` — permissive (passthrough)    |

## Trackers (confirmed)

| Tracker        | Entry path               | Parent summary                                      |
| -------------- | ------------------------ | --------------------------------------------------- |
| Sleep          | `sleep/{cid}/intervals`  | `prefs.lastSleep`                                   |
| Feed           | `feed/{cid}/intervals`   | `prefs.lastFeed`, `prefs.lastSide`, `prefs.bottle*` |
| Diaper + potty | `diaper/{cid}/intervals` | `prefs.lastDiaper` / `prefs.lastPotty`              |
| Pump           | `pump/{cid}/intervals`   | `prefs.lastPump`                                    |
| Growth         | `health/{cid}/data`      | **none** — growth does NOT update parent `prefs`    |
| Custom foods   | `types/{cid}/custom`     | n/a (subcollection only; parent doc may be absent)  |

Confirmed entry shapes (`mode`/`type` is the in-collection discriminator):

- **Sleep** ✅ — `{ start, duration, offset, lastUpdated }`; `prefs.lastSleep = { start, offset, duration }`.
- **Feed / nursing** ✅ — `{ mode:"breast", leftDuration, rightDuration, lastSide, start, offset, lastUpdated }`.
- **Feed / bottle** ✅ — `{ mode:"bottle", amount, bottleType, units, start, offset, lastUpdated }`.
- **Feed / solids** 🟡 — `{ mode:"solids", start, offset, lastUpdated }`. The meal's
  `foods` map / `reactions` / `foodNoteImage` are **not yet captured live** — see
  the deviation note below (B5).
- **Diaper / potty** ✅ — `{ mode:"poo"|…, color?, consistency?, quantity?, isPotty?, start, offset, lastUpdated }`.
- **Pump** ✅ — `{ entryMode:"total"|"leftright", leftAmount, rightAmount, duration?, units, start, offset, lastUpdated }`.
- **Growth** ✅ — `{ mode:"growth", start, offset, lastUpdated, weight?, weightUnits, height?, heightUnits, head?, headUnits }` (metric `kg`/`cm`/`hcm`, imperial `lbs.oz`/`ft.in`/`hin`).
- **Custom food** 🟡 — we currently read leniently; the **write** shape is unconfirmed (see deviation note).

Every parent `prefs` also carries `timestamp:{ seconds:<float> }` and
`local_timestamp:<float>`, set to "now" on each write.

## Deviations from the Python reference (live wins)

- **Diaper `quantity`** ✅ — a **scalar** (`0/50/100` = little/medium/big), _not_ the
  `{pee,poo}` map the Python source uses. Live wins.
- **Solids food tracking** 🟡 (B5) — **implemented to the Python shape, not yet
  app-confirmed.** `log_solids` now writes a `foods` map
  (`{id:{id,created_name,source,amount?}}`) and `reactions`
  (`{LOVED|MEH|HATED|ALLERGIC:true}`); `create_custom_food` writes
  `{id, name, type:"solids", source:"custom", archived:false, image, created_at,
updated_at}` with ISO-string timestamps (doc id == `id`). `foodNoteImage` (meal
  photo) is **not** implemented (needs an upload). The gated live round-trip proves
  Firestore accepts + returns these, but **confirm they display correctly in the
  app** (log a solid with foods in the app and inspect `feed/{cid}/intervals`;
  create a food in the app and inspect `types/{cid}/custom`) — the field names/doc
  shape may differ from the Python reference.

## Probe findings (run 2026-07-26, prober sweep)

First real prober sweep. What it settled:

- **`health/{cid}` prefs contains `lastMedication: null`** ✅ — strong evidence
  **medication is stored in `health/{cid}/data`** (the same subcollection as growth,
  discriminated by `mode`), _not_ a separate `medication/` collection. Our
  `getGrowthHistory` already filters `mode === "growth"`, so medication rows are
  correctly ignored today — but a `log_medication`/`get_medication` feature should
  target `health/{cid}/data` with its own `mode`. **Still to capture:** the actual
  `mode` value and field shape (log a medication in the app, then re-probe).
- **`types/{cid}` parent doc is absent and `types/{cid}/custom` is empty** ✅ — the
  account has no custom foods. Confirms the parent doc is a "phantom parent" (the
  subcollection is what matters), and means the B5 custom-food shape is still
  unconfirmed against an **app-created** doc.
- **Candidate collections are denied, not empty** ⛔ — `medication/`, `temperature/`
  etc. return `permission-denied` rather than an empty read. Security rules only
  permit the collections the app actually uses, so **⛔ is itself a signal**: those
  top-level collections most likely don't exist for this project. Combined with
  `lastMedication` above, the picture is that extra trackers live inside
  `health/{cid}/data` behind `mode`, not in sibling top-level collections.

## Open questions (unresolved shapes we depend on)

- **How is an _in-progress_ session represented?** ❓ Unknown — and it matters:
  logging a sleep while a session is running in the app **ends that live session**
  (`TASKS.md` → BUG1). Every `log_*` overwrites the tracker's `prefs.last*` via
  `writeIntervalWithPrefs`, so if the app tracks the active session there (a
  `lastSleep` without `duration`? a sibling field? an interval flagged
  in-progress?), we're clobbering it. We have **never captured** this shape —
  `inProgress` appears only as an invented value in `models.test.ts`, not from real
  data. Capture: start a sleep in the app, dump `sleep/{cid}` (parent `prefs` +
  `intervals`), then `log_sleep` and dump again — the diff is the answer.

- **What are the allowed diaper `color` / `consistency` values?** 🟡 Adopted, not
  yet live-confirmed. `src/client/diaperOps.ts` now constrains both to a fixed
  set (`DIAPER_COLORS`/`DIAPER_CONSISTENCIES`) at the MCP tool boundary to close
  BUG2 (an unrecognized value could crash the app on that entry). **This is a
  deliberate exception to verify-first**, taken on explicit user instruction: the
  set is ported from the legacy `src/client/healthOps.ts` union
  (yellow/brown/green/black/red/white/orange/other;
  hard/normal/soft/runny/watery/formed/mucousy), not captured from real
  Firestore data — casing and enum-key-vs-display-name are still unconfirmed. If
  it ever mismatches the app, capture it properly: log one diaper per
  color/consistency from the app, dump `diaper/{cid}/intervals`, and update this
  entry + `DIAPER_COLORS`/`DIAPER_CONSISTENCIES` from the observed strings.

## Candidates to confirm (❓)

Guessed from the app's features / the Python reference; **not yet probed**. The
inspector sweeps these by default and reports exists/empty/absent — but a guessed
sub being empty is **not** proof the feature doesn't exist (it may live under a
different path, e.g. inside `health/{cid}/data` behind a `mode`). Confirm the real
path/sub before trusting.

| Candidate path                             | Hypothesis                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `health/{cid}/data` (other `mode`s)        | **Most likely home** for medication / temperature / symptom — `lastMedication` in `health` prefs points here. Capture the `mode` values by logging one of each in the app, then re-probing. |
| `medication/{cid}`                         | ⛔ denied in the sweep — probably not a real top-level collection (see findings)                                                                                                            |
| `temperature/{cid}`                        | ⛔ denied — same                                                                                                                                                                            |
| `measurement/{cid}`                        | ⛔ denied — same                                                                                                                                                                            |
| `milestone/{cid}`                          | ⛔ denied — same                                                                                                                                                                            |
| `activity/{cid}`                           | ⛔ denied — same                                                                                                                                                                            |
| `symptom/{cid}`                            | ⛔ denied — same                                                                                                                                                                            |
| `journal`/`note`/`photo`/`vaccine`/`teeth` | other app sections — paths unknown; likely also `mode`s rather than collections                                                                                                             |

When one is confirmed, move it up into the tables above with its captured shape.
