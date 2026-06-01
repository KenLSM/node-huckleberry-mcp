import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUser, getChild, getChildren, getDefaultChildUid } from "../client/childOps";

// ── Mock HuckleberryClient ─────────────────────────────────────────────────

function makeClient(readDocImpl: (path: string, ...seg: string[]) => unknown) {
  return {
    getUid: vi.fn().mockResolvedValue("uid-abc"),
    readDoc: vi.fn().mockImplementation(readDocImpl),
    connect: vi.fn().mockResolvedValue(undefined),
  } as unknown as import("../client/HuckleberryClient").HuckleberryClient;
}

const USER_DOC = {
  email: "test@example.com",
  firstname: "Test",
  childList: [
    { cid: "child-1", nickname: "Ada" },
    { cid: "child-2", nickname: "Bea" },
  ],
  lastChild: "child-2",
};

const CHILD_DOC = {
  name: "Ada",
  gender: "female",
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getUser()", () => {
  it("parses user doc and extracts childUids and lastChild", async () => {
    const client = makeClient((_path, _id) => USER_DOC);
    const result = await getUser(client);

    expect(result.user.email).toBe("test@example.com");
    expect(result.childUids).toEqual(["child-1", "child-2"]);
    expect(result.lastChild).toBe("child-2");
  });

  it("throws when user doc is missing", async () => {
    const client = makeClient(() => null);
    await expect(getUser(client)).rejects.toThrow("User document not found");
  });

  it("defaults childUids to [] when childList absent", async () => {
    const client = makeClient(() => ({ email: "x@y.com" }));
    const result = await getUser(client);
    expect(result.childUids).toEqual([]);
    expect(result.lastChild).toBeNull();
  });
});

describe("getChild()", () => {
  it("returns parsed child document", async () => {
    const client = makeClient(() => CHILD_DOC);
    const result = await getChild(client, "child-1");
    expect(result?.name).toBe("Ada");
    expect(result?.gender).toBe("female");
  });

  it("returns null when child doc missing", async () => {
    const client = makeClient(() => null);
    const result = await getChild(client, "missing-child");
    expect(result).toBeNull();
  });
});

describe("getChildren()", () => {
  it("fetches all child profiles in parallel", async () => {
    const client = makeClient((path, id) => {
      if (path === "users") return USER_DOC;
      if (id === "child-1") return { name: "Ada", sex: "female" };
      if (id === "child-2") return { name: "Bea", sex: "female" };
      return null;
    });

    const results = await getChildren(client);

    expect(results).toHaveLength(2);
    expect(results[0].cid).toBe("child-1");
    expect(results[0].profile?.name).toBe("Ada");
    expect(results[1].cid).toBe("child-2");
    expect(results[1].profile?.name).toBe("Bea");
  });

  it("sets profile to null when child doc is missing", async () => {
    const client = makeClient((path) => {
      if (path === "users") return USER_DOC;
      return null;
    });

    const results = await getChildren(client);
    expect(results[0].profile).toBeNull();
  });
});

describe("getDefaultChildUid()", () => {
  it("returns lastChild when present in childList", async () => {
    const client = makeClient(() => USER_DOC);
    const uid = await getDefaultChildUid(client);
    expect(uid).toBe("child-2");
  });

  it("falls back to first childList entry when lastChild missing", async () => {
    const client = makeClient(() => ({
      childList: [{ cid: "child-1" }, { cid: "child-2" }],
    }));
    const uid = await getDefaultChildUid(client);
    expect(uid).toBe("child-1");
  });

  it("throws when no children exist", async () => {
    const client = makeClient(() => ({ childList: [] }));
    await expect(getDefaultChildUid(client)).rejects.toThrow("No children found");
  });
});
