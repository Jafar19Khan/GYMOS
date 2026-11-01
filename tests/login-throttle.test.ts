import { describe, expect, it } from "vitest";
import { createLoginThrottleKey } from "../src/lib/auth/login-throttle-key";

describe("login throttle key", () => {
  it("normalizes email before hashing", () => {
    expect(createLoginThrottleKey(" USER@example.com ", "127.0.0.1"))
      .toBe(createLoginThrottleKey("user@example.com", "127.0.0.1"));
  });

  it("separates attempts from different source IP buckets", () => {
    expect(createLoginThrottleKey("user@example.com", "127.0.0.1"))
      .not.toBe(createLoginThrottleKey("user@example.com", "127.0.0.2"));
  });

  it("does not expose the email or address in the stored key", () => {
    const key = createLoginThrottleKey("user@example.com", "127.0.0.1");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("user@example.com");
    expect(key).not.toContain("127.0.0.1");
  });
});
