import { describe, expect, it } from "vitest";
import {
  createAttendanceQrToken,
  QR_ATTENDANCE_TTL_SECONDS,
  verifyAttendanceQrToken,
} from "../src/lib/auth/attendance-qr";

const gymId = "1c5bc4e6-2f5e-4d5b-b8ef-7c6b5d4e3f21";
const memberId = "2d6cd5f7-3a6f-4e6c-9c0f-8d7e6f5a4b32";
const secret = "test-only-qr-signing-secret-with-more-than-32-bytes";
const now = Date.UTC(2026, 10, 1, 12, 0, 0);

describe("signed QR attendance tokens", () => {
  it("issues a signed token with the expected 60-second validity", () => {
    const token = createAttendanceQrToken(gymId, memberId, secret, now);
    const verified = verifyAttendanceQrToken(token, secret, now);
    expect(verified?.gymId).toBe(gymId);
    expect(verified?.memberId).toBe(memberId);
    expect(verified?.expiresAt).toBe(Math.floor(now / 1000) + QR_ATTENDANCE_TTL_SECONDS);
  });

  it("rejects expired tokens", () => {
    const token = createAttendanceQrToken(gymId, memberId, secret, now);
    expect(verifyAttendanceQrToken(token, secret, now + 61000)).toBeNull();
  });

  it("rejects a different secret and tampered payload", () => {
    const token = createAttendanceQrToken(gymId, memberId, secret, now);
    expect(verifyAttendanceQrToken(token, "other-secret-with-at-least-32-bytes", now)).toBeNull();
    const parts = token.split(".");
    const tampered = `${parts[0].slice(0, -1)}A.${parts[1]}`;
    expect(verifyAttendanceQrToken(tampered, secret, now)).toBeNull();
  });

  it("rejects malformed tokens and weak secrets", () => {
    expect(verifyAttendanceQrToken("bad", secret, now)).toBeNull();
    expect(verifyAttendanceQrToken("anything", "short", now)).toBeNull();
    expect(() => createAttendanceQrToken(gymId, memberId, "short", now)).toThrow();
    expect(() => createAttendanceQrToken("not-a-uuid", memberId, secret, now)).toThrow();
  });
});
