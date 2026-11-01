import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_HOURS = 48;

export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isInvitationTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
