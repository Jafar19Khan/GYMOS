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

export type InvitationAccountState = {
  gymId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  user: {
    role: string;
    status: string;
    gymId: string | null;
    isGymOwner: boolean;
  };
};

export function isInvitationUsable(
  invitation: InvitationAccountState | null,
  now: Date,
): boolean {
  if (!invitation) return false;
  const supportedAccount =
    invitation.user.role === "MEMBER" ||
    (invitation.user.role === "OWNER" && !invitation.user.isGymOwner);

  return (
    supportedAccount &&
    invitation.user.gymId === invitation.gymId &&
    invitation.user.status === "INVITED" &&
    invitation.consumedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt > now
  );
}
