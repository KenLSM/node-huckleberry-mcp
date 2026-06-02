#!/usr/bin/env node
/**
 * Live schema inspector (part of the T3.2 integration harness).
 *
 * Logs into a REAL Huckleberry account and dumps the raw Firestore document
 * shapes for every tracker, so we can port the client models/ops to the actual
 * schema instead of guessing. Read-only: it never writes.
 *
 * Usage:
 *   HUCKLEBERRY_EMAIL=you@example.com HUCKLEBERRY_PASSWORD='…' \
 *     node scripts/inspect-schema.mjs
 *
 * Optional: CHILD_UID=<cid> to inspect a specific child (default: lastChild).
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, getDocs, query, limit } from "firebase/firestore";

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

// The child profile doc — captures the real shape of childs/{cid} (gender, etc.).
const childSnap = await getDoc(doc(db, "childs", cid));
dump(`childs/${cid} (child profile)`, childSnap.data() ?? null);

// parent doc → show prefs/summary shape; subcollection → show a few raw entries.
const trackers = [
  { name: "sleep", sub: "intervals" },
  { name: "feed", sub: "intervals" },
  { name: "diaper", sub: "intervals" },
  { name: "pump", sub: "intervals" },
  { name: "health", sub: "data" },
];

for (const { name, sub } of trackers) {
  const parentSnap = await getDoc(doc(db, name, cid));
  const parent = parentSnap.data() ?? null;
  dump(
    `${name}/${cid} (parent — note .prefs)`,
    parent ? { prefs: parent.prefs ?? null, keys: Object.keys(parent) } : null,
  );

  // Several entry types share one collection (feed = nursing/bottle/pump-less/solids,
  // diaper = diaper+potty), so pull enough to capture each variant.
  const snap = await getDocs(query(collection(db, name, cid, sub), limit(15)));
  if (snap.empty) {
    dump(`${name}/${cid}/${sub} (sample entries)`, null);
  } else {
    snap.docs.forEach((d, i) => dump(`${name}/${cid}/${sub}[${i}] id=${d.id}`, d.data()));
  }
}

console.log(
  "\nDone. Paste this output back so the client models/ops can be ported to the real schema.",
);
process.exit(0);
