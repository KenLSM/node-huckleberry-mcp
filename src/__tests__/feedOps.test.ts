import { describe, it, expect } from "vitest";
import {
  logNursing,
  logBottle,
  logSolids,
  logPump,
  getFeedHistory,
  listPumpIntervals,
} from "../client/feedOps.js";

describe("feedOps", () => {
  describe("logNursing()", () => {
    it("is a function", () => {
      expect(typeof logNursing).toBe("function");
    });
  });

  describe("logBottle()", () => {
    it("is a function", () => {
      expect(typeof logBottle).toBe("function");
    });
  });

  describe("logSolids()", () => {
    it("is a function", () => {
      expect(typeof logSolids).toBe("function");
    });
  });

  describe("logPump()", () => {
    it("is a function", () => {
      expect(typeof logPump).toBe("function");
    });
  });

  describe("getFeedHistory()", () => {
    it("is a function", () => {
      expect(typeof getFeedHistory).toBe("function");
    });
  });

  describe("listPumpIntervals()", () => {
    it("is a function", () => {
      expect(typeof listPumpIntervals).toBe("function");
    });
  });
});
