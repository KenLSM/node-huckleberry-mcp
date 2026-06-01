import type { HuckleberryClient } from "./HuckleberryClient.js";
import {
  FirebaseUserDocument,
  ChildDocument,
  type FirebaseUserDocumentParsed,
  type ChildDocumentParsed,
  type ChildListEntryParsed,
} from "../models/index.js";

export interface ChildWithProfile extends ChildListEntryParsed {
  profile: ChildDocumentParsed | null;
}

export interface UserWithChildren {
  user: FirebaseUserDocumentParsed;
  /** All child UIDs from childList[].cid */
  childUids: string[];
  /** The lastChild uid from the user doc, if set */
  lastChild: string | null;
}

/**
 * Reads and parses the user document at users/{uid}.
 * Returns the parsed document plus the resolved child UID list.
 */
export async function getUser(client: HuckleberryClient): Promise<UserWithChildren> {
  const uid = await client.getUid();
  const raw = await client.readDoc("users", uid);
  if (!raw) {
    throw new Error(`User document not found for uid=${uid}`);
  }
  const user = FirebaseUserDocument.parse(raw);
  const childUids = user.childList.map((entry) => entry.cid);
  return {
    user,
    childUids,
    lastChild: user.lastChild ?? null,
  };
}

/**
 * Reads and parses a child profile at childs/{childUid}.
 * Returns null if the document does not exist.
 */
export async function getChild(
  client: HuckleberryClient,
  childUid: string,
): Promise<ChildDocumentParsed | null> {
  const raw = await client.readDoc("childs", childUid);
  if (!raw) return null;
  return ChildDocument.parse(raw);
}

/**
 * Reads all child profiles for the authenticated user.
 * Uses childList[].cid as the source of truth for child UIDs.
 * Profiles are fetched in parallel and zipped with their list metadata.
 */
export async function getChildren(client: HuckleberryClient): Promise<ChildWithProfile[]> {
  const { user } = await getUser(client);
  const profiles = await Promise.all(
    user.childList.map(async (entry) => {
      const profile = await getChild(client, entry.cid);
      return { ...entry, profile };
    }),
  );
  return profiles;
}

/**
 * Returns the default child UID to use when none is specified.
 * Prefers lastChild, falls back to the first entry in childList.
 */
export async function getDefaultChildUid(client: HuckleberryClient): Promise<string> {
  const { childUids, lastChild } = await getUser(client);
  if (lastChild && childUids.includes(lastChild)) return lastChild;
  if (childUids.length > 0) return childUids[0];
  throw new Error("No children found for this account.");
}
