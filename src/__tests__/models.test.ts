import { describe, it, expect } from "vitest";
import {
  FirebaseUserDocument,
  ChildDocument,
  SleepInterval,
  FeedingInterval,
  GrowthRecord,
  DiaperLog,
  CustomFood,
} from "../models/index.js";

describe("Data Models", () => {
  describe("FirebaseUserDocument", () => {
    it("parses a valid user document", () => {
      const data = {
        childList: [{ cid: "child1", nickname: "Baby" }],
        hbChilds: { child1: { addedAt: 1234567890 } },
        lastChild: "child1",
        email: "user@example.com",
        firstname: "John",
        lastname: "Doe",
      };
      const result = FirebaseUserDocument.parse(data);
      expect(result.childList[0].cid).toBe("child1");
      expect(result.email).toBe("user@example.com");
    });

    it("round-trips user document", () => {
      const data = {
        childList: [{ cid: "abc123" }],
        lastChild: "abc123",
      };
      const parsed = FirebaseUserDocument.parse(data);
      const reparsed = FirebaseUserDocument.parse(parsed);
      expect(reparsed.childList[0].cid).toBe("abc123");
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
      const now = Date.now();
      const data = {
        id: "sleep1",
        childUid: "child1",
        startTime: now - 3600000,
        endTime: now,
        createdAt: now,
        updatedAt: now,
        status: "completed" as const,
      };
      const result = SleepInterval.parse(data);
      expect(result.id).toBe("sleep1");
      expect(result.status).toBe("completed");
    });

    it("round-trips sleep interval", () => {
      const now = Date.now();
      const data = {
        id: "sleep2",
        childUid: "child1",
        startTime: now,
        createdAt: now,
        updatedAt: now,
        status: "active" as const,
      };
      const parsed = SleepInterval.parse(data);
      const reparsed = SleepInterval.parse(parsed);
      expect(reparsed.id).toBe("sleep2");
    });
  });

  describe("FeedingInterval", () => {
    it("parses a valid feeding interval", () => {
      const now = Date.now();
      const data = {
        id: "feed1",
        childUid: "child1",
        startTime: now,
        type: "nursing" as const,
        side: "left" as const,
        createdAt: now,
        updatedAt: now,
      };
      const result = FeedingInterval.parse(data);
      expect(result.type).toBe("nursing");
      expect(result.side).toBe("left");
    });

    it("round-trips feeding interval", () => {
      const now = Date.now();
      const data = {
        id: "feed2",
        childUid: "child1",
        startTime: now,
        amount: 120,
        type: "bottle" as const,
        createdAt: now,
        updatedAt: now,
      };
      const parsed = FeedingInterval.parse(data);
      const reparsed = FeedingInterval.parse(parsed);
      expect(reparsed.amount).toBe(120);
    });
  });

  describe("GrowthRecord", () => {
    it("parses a valid growth record", () => {
      const now = Date.now();
      const data = {
        id: "growth1",
        childUid: "child1",
        date: now,
        weight: 7.5,
        height: 65,
        headCircumference: 42,
        unit: "metric" as const,
        createdAt: now,
        updatedAt: now,
      };
      const result = GrowthRecord.parse(data);
      expect(result.weight).toBe(7.5);
      expect(result.unit).toBe("metric");
    });

    it("round-trips growth record", () => {
      const now = Date.now();
      const data = {
        id: "growth2",
        childUid: "child1",
        date: now,
        weight: 8.2,
        createdAt: now,
        updatedAt: now,
      };
      const parsed = GrowthRecord.parse(data);
      const reparsed = GrowthRecord.parse(parsed);
      expect(reparsed.weight).toBe(8.2);
    });
  });

  describe("DiaperLog", () => {
    it("parses a valid diaper log", () => {
      const now = Date.now();
      const data = {
        id: "diaper1",
        childUid: "child1",
        date: now,
        type: "both" as const,
        color: "yellow",
        consistency: "normal" as const,
        createdAt: now,
        updatedAt: now,
      };
      const result = DiaperLog.parse(data);
      expect(result.type).toBe("both");
      expect(result.color).toBe("yellow");
    });

    it("round-trips diaper log", () => {
      const now = Date.now();
      const data = {
        id: "diaper2",
        childUid: "child1",
        date: now,
        type: "pee" as const,
        createdAt: now,
        updatedAt: now,
      };
      const parsed = DiaperLog.parse(data);
      const reparsed = DiaperLog.parse(parsed);
      expect(reparsed.type).toBe("pee");
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
      expect(result.name).toBe("Banana");
      expect(result.allergens).toContain("tree nuts");
    });

    it("round-trips custom food", () => {
      const now = Date.now();
      const data = {
        id: "food2",
        childUid: "child1",
        name: "Apple Puree",
        createdAt: now,
        updatedAt: now,
      };
      const parsed = CustomFood.parse(data);
      const reparsed = CustomFood.parse(parsed);
      expect(reparsed.name).toBe("Apple Puree");
    });
  });
});
