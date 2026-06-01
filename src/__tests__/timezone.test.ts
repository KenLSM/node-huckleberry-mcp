import { describe, it, expect } from "vitest";
import { utcOffsetMinutes, huckleberryOffsetMinutes } from "../util/timezone.js";

describe("timezone offsets", () => {
  const winter = new Date("2026-01-15T12:00:00Z");
  const summer = new Date("2026-07-15T12:00:00Z");

  it("UTC is zero", () => {
    expect(utcOffsetMinutes("UTC", winter)).toBe(0);
    expect(huckleberryOffsetMinutes("UTC", winter)).toBe(0);
  });

  it("Asia/Singapore is UTC+8 year-round → huckleberry offset -480", () => {
    expect(utcOffsetMinutes("Asia/Singapore", winter)).toBe(480);
    expect(huckleberryOffsetMinutes("Asia/Singapore", summer)).toBe(-480);
  });

  it("America/New_York observes DST (EST +300 / EDT +240 huckleberry offset)", () => {
    expect(huckleberryOffsetMinutes("America/New_York", winter)).toBe(300); // EST = UTC-5
    expect(huckleberryOffsetMinutes("America/New_York", summer)).toBe(240); // EDT = UTC-4
  });
});
