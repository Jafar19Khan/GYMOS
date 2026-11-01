import { describe, expect, it } from "vitest";
import {
  createInvitationToken,
  hashInvitationToken,
  isInvitationTokenFormat,
  isInvitationUsable,
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


describe("invitation acceptance rules", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  const validInvitation = {
    gymId: "gym-1",
    expiresAt: new Date("2026-11-03T12:00:00.000Z"),
    consumedAt: null,
    revokedAt: null,
    user: {
      role: "MEMBER",
      status: "INVITED",
      gymId: "gym-1",
      isGymOwner: false,
    },
  };

  it("accepts an unexpired pending member invitation", () => {
    expect(isInvitationUsable(validInvitation, now)).toBe(true);
  });

  it("accepts pending staff but never an owner or platform admin", () => {
    expect(isInvitationUsable({
      ...validInvitation,
      user: { ...validInvitation.user, role: "OWNER" },
    }, now)).toBe(true);
    expect(isInvitationUsable({
      ...validInvitation,
      user: { ...validInvitation.user, role: "OWNER", isGymOwner: true },
    }, now)).toBe(false);
    expect(isInvitationUsable({
      ...validInvitation,
      user: { ...validInvitation.user, role: "SUPER_ADMIN" },
    }, now)).toBe(false);
  });

  it("rejects expired, consumed, revoked and cross-gym invitations", () => {
    expect(isInvitationUsable({
      ...validInvitation,
      expiresAt: new Date("2026-11-01T11:59:59.000Z"),
    }, now)).toBe(false);
    expect(isInvitationUsable({ ...validInvitation, consumedAt: now }, now)).toBe(false);
    expect(isInvitationUsable({ ...validInvitation, revokedAt: now }, now)).toBe(false);
    expect(isInvitationUsable({
      ...validInvitation,
      user: { ...validInvitation.user, gymId: "gym-2" },
    }, now)).toBe(false);
    expect(isInvitationUsable(null, now)).toBe(false);
  });

  it("rejects accounts no longer in invited status", () => {
    expect(isInvitationUsable({
      ...validInvitation,
      user: { ...validInvitation.user, status: "ACTIVE" },
    }, now)).toBe(false);
  });
});
