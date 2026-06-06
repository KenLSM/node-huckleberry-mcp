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
  GrowthEntry,
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
    it("parses a real child profile (childsName/birthdate/gender + passthrough)", () => {
      const data = {
        childsName: "Asd",
        gender: "M",
        birthdate: "2025-06-01",
        naps: "2",
        nightStart: 6,
        sweetspot: { daysUsed: 1, lastUseDay: 1780272000 },
      };
      const result = ChildDocument.parse(data);
      expect(result.childsName).toBe("Asd");
      expect(result.gender).toBe("M");
      expect(result.birthdate).toBe("2025-06-01");
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

    it("parses with only start present (resilience)", () => {
      const result = SleepInterval.parse({ start: 1, inProgress: true });
      expect(result.start).toBe(1);
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

  describe("FeedingInterval (lenient read model)", () => {
    it("parses a nursing interval", () => {
      const result = FeedingInterval.parse({ mode: "breast", start: 1700000000, offset: -480 });
      expect(result.mode).toBe("breast");
    });

    it("parses a bottle interval", () => {
      const result = FeedingInterval.parse({
        mode: "bottle",
        start: 1700000000,
        offset: -480,
        amount: 120,
        bottleType: "Breast Milk",
        units: "ml",
      });
      expect(result.mode).toBe("bottle");
      expect(result.amount).toBe(120);
    });

    it("does not throw on an unknown mode or extra fields (resilience)", () => {
      const result = FeedingInterval.parse({ mode: "fortifier", start: 1, somethingNew: true });
      expect(result.mode).toBe("fortifier");
      expect((result as Record<string, unknown>).somethingNew).toBe(true);
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

    it("parses a sparse entry with unknown fields (resilience)", () => {
      const result = PumpInterval.parse({ start: 1, units: "L", note: "x" });
      expect(result.start).toBe(1);
      expect(result.units).toBe("L");
    });
  });

  describe("GrowthEntry", () => {
    it("parses a metric growth entry", () => {
      const result = GrowthEntry.parse({
        mode: "growth",
        start: 1,
        offset: -480,
        lastUpdated: 2,
        weight: 3.1,
        weightUnits: "kg",
        height: 21.6,
        heightUnits: "cm",
        head: 38,
        headUnits: "hcm",
      });
      expect(result.mode).toBe("growth");
      expect(result.weight).toBe(3.1);
    });

    it("rejects a non-growth mode", () => {
      expect(() => GrowthEntry.parse({ mode: "sleep", start: 1, offset: 0 })).toThrow();
    });
  });

  describe("notes round-trip (read models surface notes)", () => {
    it("parses notes on every tracker read model", () => {
      const notes = "a free-text note";
      expect(SleepInterval.parse({ start: 1, notes }).notes).toBe(notes);
      expect(FeedingInterval.parse({ mode: "bottle", start: 1, notes }).notes).toBe(notes);
      expect(DiaperInterval.parse({ mode: "poo", start: 1, notes }).notes).toBe(notes);
      expect(PumpInterval.parse({ start: 1, notes }).notes).toBe(notes);
      expect(GrowthEntry.parse({ mode: "growth", start: 1, notes }).notes).toBe(notes);
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
