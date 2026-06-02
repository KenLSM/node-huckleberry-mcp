import { describe, it, expect } from "vitest";
import { throwGrowthNotYetImplemented } from "../client/growthOps.js";

describe("growthOps (deferred)", () => {
  it("throws when called", () => {
    expect(() => throwGrowthNotYetImplemented()).toThrow("not yet implemented");
  });
});
