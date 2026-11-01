import { describe, expect, it } from "vitest";
import {
  createInvitationToken,
  hashInvitationToken,
  isInvitationTokenFormat,
} from "../src/lib/auth/invitations";

describe("account invitation tokens", () => {
  it("creates high-entropy URL-safe tokens in the expected format", () => {
    const token = createInvitationToken();
    expect(token).toHaveLength(43);
    expect(isInvitationTokenFormat(token)).toBe(true);
  });

  it("stores a deterministic one-way hash instead of the raw token", () => {
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toBe(token);
    expect(hashInvitationToken(token)).toBe(tokenHash);
  });

  it("rejects malformed invitation tokens", () => {
    expect(isInvitationTokenFormat("")).toBe(false);
    expect(isInvitationTokenFormat("not-a-token")).toBe(false);
    expect(isInvitationTokenFormat("x".repeat(44))).toBe(false);
  });
});
