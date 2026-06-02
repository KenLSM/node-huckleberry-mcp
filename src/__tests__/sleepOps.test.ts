import { describe, it, expect } from "vitest";
import { logSleep, getSleepHistory } from "../client/sleepOps.js";

describe("sleepOps", () => {
  it("logSleep is a function", () => {
    expect(typeof logSleep).toBe("function");
  });

  it("getSleepHistory is a function", () => {
    expect(typeof getSleepHistory).toBe("function");
  });
});
