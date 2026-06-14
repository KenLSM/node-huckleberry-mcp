#!/usr/bin/env node
/**
 * Live Firestore schema inspector / discovery prober (T3.2 harness; B6).
 *
 * Logs into a REAL Huckleberry account and probes a set of candidate Firestore
 * paths, reporting which exist and dumping their document shapes, so we can map
 * the full schema empirically instead of guessing. The Firebase client SDK can't
 * list collections, so discovery is *guided*: we probe known + candidate paths.
 * See docs/discovery-plan.md. Read-only — it never writes.
 *
 * Usage:
 *   HUCKLEBERRY_EMAIL=you@example.com HUCKLEBERRY_PASSWORD='…' \
 *     node scripts/inspect-schema.mjs
 *
 * Options (env):
 *   CHILD_UID    inspect a specific child (default: lastChild / first child).
 *   PROBE_PATHS  extra probe specs, comma-separated. Each spec is "doc" or
 *                "doc:sub" with {cid}/{uid} placeholders, e.g.
 *                "medication/{cid}:entries,types/{cid}:custom".
 *   ONLY_PROBES  "1" to probe ONLY PROBE_PATHS (skip the built-in candidates).
 *   SAMPLE       max sample entries dumped per subcollection (default 8).
 *   OUT          write machine-readable JSON here (default: schema-dump.json).
 *                Set OUT=- to skip the JSON file. The dump may contain personal
 *                data — it is gitignored; don't commit it.
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, getDocs, query, limit } from "firebase/firestore";
import { writeFileSync } from "node:fs";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyApGVHktXeekGyAt-G6dIeWHUkq2oXqcjg",
  projectId: "simpleintervals",
  appId: "1:219218185774:android:a3e215cc246b92b0",
};

const email = process.env.HUCKLEBERRY_EMAIL;
const password = process.env.HUCKLEBERRY_PASSWORD;
if (!email || !password) {
  console.error("Set HUCKLEBERRY_EMAIL and HUCKLEBERRY_PASSWORD to run the inspector.");
  process.exit(2);
}

const SAMPLE = Number(process.env.SAMPLE ?? 8);
const OUT = process.env.OUT ?? "schema-dump.json";

// ── Probe specs ──────────────────────────────────────────────────────────────
// A spec is "doc" or "doc:sub" with {cid}/{uid} placeholders. `verified` paths
// are the live-confirmed schema; `candidate` paths are guesses we sweep to
// discover collections we don't model yet (most will report empty/absent — that
// is the point). Add more at runtime with PROBE_PATHS without editing this file.
const VERIFIED = [
  "users/{uid}",
  "childs/{cid}",
  "sleep/{cid}:intervals",
  "feed/{cid}:intervals",
  "diaper/{cid}:intervals",
  "pump/{cid}:intervals",
  "health/{cid}:data",
  "types/{cid}:custom",
];

// Guesses (one plausible subcollection each) — confirm/expand via PROBE_PATHS.
const CANDIDATES = [
  "medication/{cid}:data",
  "temperature/{cid}:data",
  "measurement/{cid}:data",
  "milestone/{cid}:data",
  "activity/{cid}:intervals",
  "symptom/{cid}:data",
  "mood/{cid}:data",
  "journal/{cid}:entries",
  "photo/{cid}:data",
  "vaccine/{cid}:data",
  "teeth/{cid}:data",
];

function parseSpec(spec) {
  const [docPath, sub] = spec.trim().split(":");
  return { spec: spec.trim(), docPath, sub: sub || null };
}

function buildProbeList() {
  const extra = (process.env.PROBE_PATHS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const onlyProbes = process.env.ONLY_PROBES === "1";
  const base = onlyProbes ? [] : [...VERIFIED, ...CANDIDATES];
  // De-dupe by spec, preserving order (extras last so they can't be dropped).
  const seen = new Set();
  return [...base, ...extra]
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .map(parseSpec);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Reveal Firestore types (Timestamp vs number) in the JSON dump.
function annotate(value) {
  if (value && typeof value === "object") {
    const ctor = value.constructor?.name;
    if (ctor === "Timestamp")
      return { __Timestamp: { seconds: value.seconds, nanos: value.nanoseconds } };
    if (Array.isArray(value)) return value.map(annotate);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = annotate(v);
    return out;
  }
  return typeof value === "number" ? { __number: value } : value;
}

function dump(label, data) {
  console.log(`\n──── ${label} ────`);
  console.log(data === null ? "(no document)" : JSON.stringify(annotate(data), null, 2));
}

// Distinct discriminator values (mode/type) across sample entries — surfaces the
// variants multiplexed into one collection (e.g. feed = nursing/bottle/solids).
function discriminators(samples) {
  const out = {};
  for (const key of ["mode", "type"]) {
    const vals = [...new Set(samples.map((s) => s[key]).filter((v) => v !== undefined))];
    if (vals.length) out[key] = vals;
  }
  return out;
}

// ── Connect ──────────────────────────────────────────────────────────────────

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const cred = await signInWithEmailAndPassword(auth, email, password);
const uid = cred.user.uid;
console.log(`Authenticated uid=${uid}`);

const userSnap = await getDoc(doc(db, "users", uid));
const user = userSnap.data() ?? {};
const childUids = Array.isArray(user.childList) ? user.childList.map((c) => c.cid) : [];
const cid = process.env.CHILD_UID || user.lastChild || childUids[0];
console.log(`childList: ${childUids.join(", ") || "(none)"}\nInspecting child cid=${cid}`);
if (!cid) {
  console.error("No child found on this account; cannot inspect tracker schemas.");
  process.exit(1);
}

const resolve = (tpl) => tpl.replaceAll("{cid}", cid).replaceAll("{uid}", uid);

// ── Probe ────────────────────────────────────────────────────────────────────

const report = { capturedAt: new Date().toISOString(), uid, cid, probes: [] };

for (const { spec, docPath, sub } of buildProbeList()) {
  const docSegments = resolve(docPath).split("/");
  const entry = { spec, docPath: resolve(docPath), doc: null, sub: null };

  // Parent document (may be absent even when a subcollection exists — phantom
  // parent — so a missing doc is not proof the path is unused).
  const parentSnap = await getDoc(doc(db, ...docSegments));
  const parent = parentSnap.exists() ? parentSnap.data() : null;
  entry.doc = parent
    ? {
        status: "exists",
        keys: Object.keys(parent),
        prefsKeys: parent.prefs ? Object.keys(parent.prefs) : null,
      }
    : { status: "absent" };
  dump(
    `${resolve(docPath)} (parent doc)`,
    parent ? { prefs: parent.prefs ?? null, keys: Object.keys(parent) } : null,
  );

  // Subcollection sample.
  if (sub) {
    const subPath = `${resolve(docPath)}/${sub}`;
    const snap = await getDocs(query(collection(db, ...docSegments, sub), limit(SAMPLE)));
    const samples = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    entry.sub = {
      path: subPath,
      status: samples.length ? "has-entries" : "empty/absent",
      count: samples.length,
      discriminators: discriminators(samples),
      sampleIds: samples.map((s) => s.id),
      samples: samples.map(annotate),
    };
    if (samples.length === 0) {
      dump(`${subPath} (sample entries)`, null);
    } else {
      snap.docs.forEach((d, i) => dump(`${subPath}[${i}] id=${d.id}`, d.data()));
    }
  }

  report.probes.push(entry);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log("\n──── probe summary ────");
for (const p of report.probes) {
  const docState = p.doc.status === "exists" ? "doc✓" : "doc✗";
  const subState = p.sub
    ? p.sub.status === "has-entries"
      ? `${p.sub.path} ✓ (${p.sub.count}${
          Object.keys(p.sub.discriminators).length ? ` ${JSON.stringify(p.sub.discriminators)}` : ""
        })`
      : `${p.sub.path} ∅`
    : "";
  console.log(`  ${docState}  ${p.spec.padEnd(26)} ${subState}`);
}

if (OUT !== "-") {
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`\nWrote machine-readable dump to ${OUT} (gitignored — do not commit).`);
}

console.log("\nDone. Update docs/firestore-schema.md with anything newly confirmed.");
process.exit(0);
