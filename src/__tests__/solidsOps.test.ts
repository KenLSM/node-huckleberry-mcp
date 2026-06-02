import { describe, it, expect } from "vitest";
import { listCuratedFoods, listCustomFoods, createCustomFood } from "../client/solidsOps.js";

describe("solidsOps", () => {
  describe("listCuratedFoods()", () => {
    it("is a function", () => {
      expect(typeof listCuratedFoods).toBe("function");
    });
  });

  describe("listCustomFoods()", () => {
    it("is a function", () => {
      expect(typeof listCustomFoods).toBe("function");
    });
  });

  describe("createCustomFood()", () => {
    it("is a function", () => {
      expect(typeof createCustomFood).toBe("function");
    });
  });
});
