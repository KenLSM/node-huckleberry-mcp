// T0.2 spike: validate that the Firebase JS SDK can replicate the Python
// client's auth + Firestore data path in Node.
//
// Reverse-engineered config + collection layout come from
// Woyken/py-huckleberry-api (src/huckleberry_api/const.py + api.py).
//
// Run:  HUCKLEBERRY_EMAIL=you@example.com HUCKLEBERRY_PASSWORD=... node spike.mjs
// Without credentials it still exercises SDK init + the live auth endpoint
// (expected to fail with an auth/* error, which itself proves the path works).

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApGVHktXeekGyAt-G6dIeWHUkq2oXqcjg",
  projectId: "simpleintervals",
  appId: "1:219218185774:android:a3e215cc246b92b0",
};

const email = process.env.HUCKLEBERRY_EMAIL ?? "spike-probe@example.invalid";
const password = process.env.HUCKLEBERRY_PASSWORD ?? "definitely-not-real";
const haveRealCreds = Boolean(
  process.env.HUCKLEBERRY_EMAIL && process.env.HUCKLEBERRY_PASSWORD,
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("[ok] Firebase SDK initialized with reverse-engineered config");

try {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log(`[ok] Authenticated as uid=${uid}`);

  // users/{uid} — the canonical read from py-huckleberry-api get_user()
  const userSnap = await getDoc(doc(db, "users", uid));
  console.log(`[ok] users/${uid} read; exists=${userSnap.exists()}`);
  if (userSnap.exists()) {
    const data = userSnap.data();
    const childKeys = data.childs ? Object.keys(data.childs) : [];
    console.log(`[ok] user doc top-level keys: ${Object.keys(data).join(", ")}`);
    console.log(`[ok] child UIDs: ${childKeys.join(", ") || "(none in users doc)"}`);
  }
  console.log("\nRESULT: Firebase JS SDK fully replicates the Python data path. ✅");
  process.exit(0);
} catch (err) {
  const code = err?.code ?? "(no code)";
  if (!haveRealCreds && code.startsWith("auth/")) {
    console.log(`[expected] auth failed with '${code}' using probe creds.`);
    console.log(
      "RESULT: SDK init + live auth endpoint reachable. Re-run with real " +
        "HUCKLEBERRY_EMAIL/PASSWORD to validate the Firestore read. ✅",
    );
    process.exit(0);
  }
  console.error(`RESULT: spike failed — code=${code}`, err);
  process.exit(1);
}
