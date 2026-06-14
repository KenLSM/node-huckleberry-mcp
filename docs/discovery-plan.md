# Discovery plan — mapping Huckleberry's APIs & Firestore shapes

How we find out **everything** Huckleberry does (every Firestore collection, every
document shape, every read/write operation) so we can port features confidently
and catch where the Python reference is wrong. This is the method behind the
"verify features ourselves" policy in `CLAUDE.md`.

## Why this is needed

- The Python repos are reverse-engineered leads, not a spec — they miss features
  (e.g. the `bckenstler` MCP has no solids tools at all) and can be stale or wrong
  about field names/shapes.
- The Firebase **client SDK cannot list** root collections or subcollection names
  (security rules + API design). So we can't "crawl" the database — discovery is
  **guided**: enumerate candidate paths from evidence, then probe each one.
- Writes are the riskiest to port blind. We must observe the _real_ document a
  write produces before replicating it.

## Sources of truth (ranked)

1. **The real Firestore data on our account** — authoritative for document
   _shapes_. Captured with `scripts/inspect-schema.mjs`.
2. **The official app's behavior** — authoritative for _operations_ (which paths
   are written, what payload, what queries). Captured by acting in the app and
   re-reading Firestore, or (deeper) by traffic capture.
3. **The Python reference** (`Woyken/py-huckleberry-api`, `bckenstler/py-huckleberry-mcp`)
   — leads only: candidate collection paths, field names, enums. Always verify
   before trusting.

## The core loop (cheap, safe, primary)

For every feature/area we want to map:

1. **Act in the app** — perform the action once (e.g. log a solids meal with two
   foods, a "LOVED" reaction, and a photo; add a medication; add a caregiver).
2. **Inspect Firestore** — run `npm run inspect:schema` (extended, see below) and
   capture the resulting document(s): the entry, its parent `prefs`, and any other
   doc that changed.
3. **Model to the observed shape** — write/adjust the Zod model + op to what we
   actually saw, not what Python says.
4. **Prove it** — gated live round-trip (`HUCKLEBERRY_ALLOW_WRITES=1`): write →
   read-back → (edit) → delete, asserting the fields we care about.
5. **Record it** — update the schema catalog (below) and note any deviation from
   the Python port.

This "act → inspect" loop avoids decoding Firestore's gRPC/protobuf traffic: the
database _is_ the ground truth, so we read the result instead of the wire.

## Tracks

### Track A — Enumerate candidate collections (breadth)

Build the candidate list of top-level collections and subcollections from
evidence, since we can't list them:

- **Known/verified today:** `users/{uid}`, `childs/{cid}`, and per-tracker
  `{collection}/{cid}` + subcollection: `sleep|feed|diaper|pump` → `intervals`,
  `health` → `data`, plus each tracker's parent `prefs`. Custom foods at
  `types/{cid}/custom`.
- **Mine the Python source** (`firebase_types.py`, `api.py`, `const.py`) for every
  collection path and document class → candidate paths (e.g. medications,
  milestones, measurements, tags, reminders, sharing/caregivers, account/
  subscription, settings, notes/photos).
- **Mine the app** — features visible in the UI imply collections (medicine,
  temperature, symptoms, milestones, activities, pumping inventory, etc.).

Output: a checklist of candidate paths to probe.

### Track B — Probe candidate paths (does it exist? what's in it?)

Extend `scripts/inspect-schema.mjs` into a configurable prober that, for each
candidate path:

- reads the parent doc (if `{collection}/{cid}` style) and dumps `prefs` + top-level keys;
- queries the subcollection (`limit N`) and dumps sample entries;
- reports `exists / empty / not-found` per path so we learn the real layout.

Drive the candidate list via an env/arg (e.g. `PROBE_PATHS=...`) so we can sweep
new paths without editing code each time.

### Track C — Variant coverage (depth)

Many collections multiplex types via a discriminator — `feed` =
nursing/bottle/solids, `diaper` = diaper/potty, `health/data` = growth (+ likely
temperature/medication/symptom), `types/{cid}/custom` = `type: "solids"` (+ maybe
others). For each, **log one of every variant in-app**, then capture, so models
cover all modes — not just the first one we happen to see.

### Track D — Operation capture (the real "API")

To know _exactly_ what the app writes (and any server-side massaging), two options:

- **Preferred — act→inspect diff:** snapshot the relevant doc(s) before and after
  an in-app action; the diff is the write. No decoding needed.
- **Deeper — traffic capture (only if act→inspect is ambiguous):** Android app +
  mitmproxy/Charles with a user CA, or Frida, against `firestore.googleapis.com`.
  Firestore uses gRPC/HTTP2 + protobuf, so payloads need decoding — heavier; use
  sparingly. (Note: raw Firestore REST is rejected for us —
  `ACCESS_TOKEN_TYPE_UNSUPPORTED` — so the app isn't using simple REST we could
  replay.)

### Track E — Reconcile & record (living catalog)

Maintain a **schema catalog** (`docs/firestore-schema.md`, seeded from
`docs/architecture.md`'s verified section) listing, per path:

- field names, types (number vs Firestore `Timestamp`), required vs optional;
- the discriminator values seen;
- **deviation notes** where the real shape differs from the Python port.

Make the inspector emit **machine-readable JSON** (alongside the annotated console
dump) so we can diff captures over time and semi-generate Zod models.

## Tooling deliverables

1. **Upgrade `scripts/inspect-schema.mjs`** to:
   - accept a configurable list of paths/subcollections to probe (Track B);
   - report exists/empty/not-found per path;
   - emit JSON (not just console) for diffing/model-gen.
2. **Seed `docs/firestore-schema.md`** — the living catalog (Track E).
3. **Candidate-path list** mined from the Python source + app UI (Track A).
4. Keep all of it **gated on creds**; never commit raw dumps containing personal
   data (scrub ids/names, or keep dumps out of git).

## Constraints & gotchas

- Client SDK can't enumerate collections/subcollections — discovery is guided, not
  exhaustive crawling. Absence of a guessed path ≠ proof it doesn't exist.
- Security rules scope us to our own account's data — that's all we need.
- Some state is server-derived (e.g. `prefs.last*` summaries, growth percentiles);
  capture it but don't assume the client must write it.
- Writes touch a real account — use a **test account** for write captures, and the
  existing double-gate (`HUCKLEBERRY_ALLOW_WRITES=1`) for automated round-trips.

## First application: solids (B5)

The method's first target. In the app: log a solids meal with ≥2 foods (one
curated, one custom), a reaction, and a photo; create a custom food. Then inspect
`feed/{cid}/intervals` and `types/{cid}/custom`, compare to the Python shapes (the
solids interval's `foods` map, `reactions`, and `foodNoteImage`; the custom-food
doc's `type`, `archived`, `source`, and `image` fields plus ISO timestamps), and
port to whatever the **real** docs show.
