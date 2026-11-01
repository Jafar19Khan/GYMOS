import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

export const QR_ATTENDANCE_TTL_SECONDS = 60;

export type AttendanceQrPayload = {
  version: 1;
  gymId: string;
  memberId: string;
  nonce: string;
  expiresAt: number;
};

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function signature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64url");
}

export function createAttendanceQrToken(
  gymId: string,
  memberId: string,
  secret: string,
  now = Date.now(),
): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("ATTENDANCE_QR_SECRET must contain at least 32 bytes.");
  }
  if (!validUuid(gymId) || !validUuid(memberId)) throw new Error("Invalid QR attendance identity.");

  const payload: AttendanceQrPayload = {
    version: 1,
    gymId,
    memberId,
    nonce: randomUUID(),
    expiresAt: Math.floor(now / 1000) + QR_ATTENDANCE_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

export function verifyAttendanceQrToken(
  token: string,
  secret: string,
  now = Date.now(),
): AttendanceQrPayload | null {
  if (Buffer.byteLength(secret, "utf8") < 32 || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [body, receivedSignature] = parts;
  const expectedSignature = signature(body, secret);
  const received = Buffer.from(receivedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AttendanceQrPayload>;
    const nowSeconds = Math.floor(now / 1000);
    if (
      payload.version !== 1 ||
      typeof payload.gymId !== "string" || !validUuid(payload.gymId) ||
      typeof payload.memberId !== "string" || !validUuid(payload.memberId) ||
      typeof payload.nonce !== "string" || !validUuid(payload.nonce) ||
      typeof payload.expiresAt !== "number" ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= nowSeconds ||
      payload.expiresAt > nowSeconds + QR_ATTENDANCE_TTL_SECONDS + 5
    ) return null;

    return payload as AttendanceQrPayload;
  } catch {
    return null;
  }
}
