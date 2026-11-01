import { describe, expect, it } from "vitest";
import { getClassBookingStatus } from "../src/lib/operations/classes";

describe("class booking capacity", () => {
  it("confirms a place while capacity remains", () => {
    expect(getClassBookingStatus(12, 0)).toBe("BOOKED");
    expect(getClassBookingStatus(12, 11)).toBe("BOOKED");
  });

  it("uses the waitlist when the class is full", () => {
    expect(getClassBookingStatus(12, 12)).toBe("WAITLISTED");
    expect(getClassBookingStatus(12, 18)).toBe("WAITLISTED");
  });

  it("rejects invalid capacity and booking counts", () => {
    expect(() => getClassBookingStatus(0, 0)).toThrow();
    expect(() => getClassBookingStatus(12, -1)).toThrow();
    expect(() => getClassBookingStatus(12, 1.5)).toThrow();
  });
});
