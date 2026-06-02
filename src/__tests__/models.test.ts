import { describe, it, expect } from "vitest";
import {
  FirebaseUserDocument,
  ChildDocument,
  SleepInterval,
  NursingInterval,
  BottleInterval,
  SolidsInterval,
  FeedingInterval,
  DiaperInterval,
  PumpInterval,
  GrowthRecord,
  CustomFood,
} from "../models/index.js";

describe("Data Models", () => {
  describe("FirebaseUserDocument", () => {
    it("parses a valid user document", () => {
      const data = {
        childList: [{ cid: "child1", nickname: "Baby" }],
        lastChild: "child1",
        email: "user@example.com",
      };
      const result = FirebaseUserDocument.parse(data);
      expect(result.childList[0].cid).toBe("child1");
      expect(result.email).toBe("user@example.com");
    });
  });

  describe("ChildDocument", () => {
    it("parses a valid child document", () => {
      const data = {
        uid: "child1",
        name: "Baby John",
        birthDate: 1609459200,
        gender: "male",
      };
      const result = ChildDocument.parse(data);
      expect(result.uid).toBe("child1");
      expect(result.name).toBe("Baby John");
    });
  });

  describe("SleepInterval", () => {
    it("parses a valid sleep interval", () => {
      const data = {
        start: 1700000000,
        duration: 3600,
        offset: -480,
        lastUpdated: 1700003600,
      };
      const result = SleepInterval.parse(data);
      expect(result.start).toBe(1700000000);
      expect(result.duration).toBe(3600);
      expect(result.offset).toBe(-480);
    });
  });

  describe("NursingInterval", () => {
    it("parses a valid nursing interval", () => {
      const data = {
        mode: "breast" as const,
        start: 1700000000,
        offset: -480,
        leftDuration: 600,
        rightDuration: 300,
        lastSide: "right" as const,
      };
      const result = NursingInterval.parse(data);
      expect(result.mode).toBe("breast");
      expect(result.leftDuration).toBe(600);
    });
  });

  describe("BottleInterval", () => {
    it("parses a valid bottle interval", () => {
      const data = {
        mode: "bottle" as const,
        start: 1700000000,
        offset: -480,
        amount: 120,
        bottleType: "Breast Milk",
        units: "ml" as const,
      };
      const result = BottleInterval.parse(data);
      expect(result.mode).toBe("bottle");
      expect(result.amount).toBe(120);
      expect(result.units).toBe("ml");
    });
  });

  describe("SolidsInterval", () => {
    it("parses a valid solids interval", () => {
      const data = {
        mode: "solids" as const,
        start: 1700000000,
        offset: -480,
      };
      const result = SolidsInterval.parse(data);
      expect(result.mode).toBe("solids");
      expect(result.start).toBe(1700000000);
    });
  });

  describe("FeedingInterval (discriminated union)", () => {
    it("parses a nursing interval via discriminated union", () => {
      const data = {
        mode: "breast" as const,
        start: 1700000000,
        offset: -480,
      };
      const result = FeedingInterval.parse(data);
      expect(result.mode).toBe("breast");
    });

    it("parses a bottle interval via discriminated union", () => {
      const data = {
        mode: "bottle" as const,
        start: 1700000000,
        offset: -480,
        amount: 120,
        bottleType: "Breast Milk",
        units: "ml" as const,
      };
      const result = FeedingInterval.parse(data);
      expect(result.mode).toBe("bottle");
      expect(result.amount).toBe(120);
    });
  });

  describe("DiaperInterval", () => {
    it("parses a valid diaper interval", () => {
      const data = {
        mode: "poo" as const,
        start: 1700000000,
        offset: -480,
        color: "yellow",
        consistency: "normal",
        quantity: 50,
      };
      const result = DiaperInterval.parse(data);
      expect(result.mode).toBe("poo");
      expect(result.color).toBe("yellow");
      expect(result.quantity).toBe(50);
    });

    it("parses a potty interval", () => {
      const data = {
        mode: "pee" as const,
        start: 1700000000,
        offset: -480,
        isPotty: true,
      };
      const result = DiaperInterval.parse(data);
      expect(result.mode).toBe("pee");
      expect(result.isPotty).toBe(true);
    });
  });

  describe("PumpInterval", () => {
    it("parses a valid pump interval", () => {
      const data = {
        entryMode: "leftright" as const,
        start: 1700000000,
        offset: -480,
        leftAmount: 120,
        rightAmount: 100,
        units: "ml" as const,
        duration: 900,
      };
      const result = PumpInterval.parse(data);
      expect(result.entryMode).toBe("leftright");
      expect(result.leftAmount).toBe(120);
      expect(result.rightAmount).toBe(100);
    });
  });

  describe("GrowthRecord (stubbed)", () => {
    it("is a stub schema", () => {
      const data = { _stub: true };
      const result = GrowthRecord.parse(data);
      expect(result._stub).toBe(true);
    });
  });

  describe("CustomFood", () => {
    it("parses a valid custom food", () => {
      const now = Date.now();
      const data = {
        id: "food1",
        childUid: "child1",
        name: "Banana",
        category: "fruit",
        allergens: ["tree nuts"],
        createdAt: now,
        updatedAt: now,
      };
      const result = CustomFood.parse(data);
      expect(result.id).toBe("food1");
      expect(result.name).toBe("Banana");
      expect(result.allergens).toContain("tree nuts");
    });
  });
});
