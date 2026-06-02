import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import type { HuckleberryClient } from "./HuckleberryClient.js";

/**
 * Writes an interval document to `{collectionName}/{childUid}/{subcollection}`
 * and merge-updates the parent doc's prefs summary, matching the Huckleberry app.
 * Returns the new interval doc id.
 */
export async function writeIntervalWithPrefs(
  client: HuckleberryClient,
  opts: {
    collectionName: string;
    subcollection: string;
    childUid: string;
    interval: Record<string, unknown>;
    prefs: Record<string, unknown>;
  },
): Promise<string> {
  await client.connect();
  const db = client.getFirestore();
  const now = Date.now() / 1000;
  const ref = await addDoc(
    collection(db, opts.collectionName, opts.childUid, opts.subcollection),
    opts.interval,
  );
  await setDoc(
    doc(db, opts.collectionName, opts.childUid),
    {
      prefs: {
        ...opts.prefs,
        timestamp: { seconds: now },
        local_timestamp: now,
      },
    },
    { merge: true },
  );
  return ref.id;
}
