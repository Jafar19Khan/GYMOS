import { describe, expect, it } from "vitest";
import { addCalendarDays, dateOnlyInTimeZone } from "../src/lib/operations/dates";

describe("gym-local calendar dates", () => {
  it("calculates dates in the configured timezone", () => {
    const lateUtc = new Date("2026-11-01T20:00:00.000Z");
    expect(dateOnlyInTimeZone(lateUtc, "UTC")).toBe("2026-11-01");
    expect(dateOnlyInTimeZone(lateUtc, "Asia/Kolkata")).toBe("2026-11-02");
  });

  it("adds calendar days across month and year boundaries", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
