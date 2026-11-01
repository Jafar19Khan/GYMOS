import { describe, expect, it } from "vitest";
import { parseRupeesToPaise } from "../src/lib/operations/money";

describe("parseRupeesToPaise", () => {
  it("converts rupees to integer paise without floating point rounding", () => {
    expect(parseRupeesToPaise("1499.50")).toBe(149950);
    expect(parseRupeesToPaise("1")).toBe(100);
    expect(parseRupeesToPaise("0.01")).toBe(1);
  });

  it("rejects zero, negative, malformed and over-precision amounts", () => {
    expect(parseRupeesToPaise("0")).toBeNull();
    expect(parseRupeesToPaise("-1")).toBeNull();
    expect(parseRupeesToPaise("1.999")).toBeNull();
    expect(parseRupeesToPaise("1,000")).toBeNull();
    expect(parseRupeesToPaise("")).toBeNull();
  });
});
