"use server";

import { Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashInvitationToken, isInvitationTokenFormat } from "@/lib/auth/invitations";
import { prisma } from "@/lib/prisma";

export type ActivationActionState = {
  ok: boolean;
  message: string;
};

const activationSchema = z.object({
  token: z.string().refine(isInvitationTokenFormat),
  password: z.string()
    .min(12)
    .max(128)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  confirmPassword: z.string().min(1).max(128),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

function invitationIsUsable(
  invitation: {
    gymId: string;
    expiresAt: Date;
    consumedAt: Date | null;
    revokedAt: Date | null;
    user: {
      role: Role;
      status: UserStatus;
      gymId: string | null;
      isGymOwner: boolean;
    };
  } | null,
  now: Date,
): boolean {
  if (!invitation) return false;
  const supportedAccount =
    invitation.user.role === Role.MEMBER ||
    (invitation.user.role === Role.OWNER && !invitation.user.isGymOwner);

  return (
    supportedAccount &&
    invitation.user.gymId === invitation.gymId &&
    invitation.user.status === UserStatus.INVITED &&
    invitation.consumedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt > now
  );
}

export async function activateAccountAction(
  _previous: ActivationActionState,
  formData: FormData,
): Promise<ActivationActionState> {
  const parsed = activationSchema.safeParse({
    token: typeof formData.get("token") === "string" ? formData.get("token") : "",
    password: typeof formData.get("password") === "string" ? formData.get("password") : "",
    confirmPassword: typeof formData.get("confirmPassword") === "string" ? formData.get("confirmPassword") : "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword")
        ? "Passwords must match. Use at least 12 characters (maximum 72 UTF-8 bytes)."
        : "Use a password with at least 12 characters (maximum 72 UTF-8 bytes).",
    };
  }

  const tokenHash = hashInvitationToken(parsed.data.token);
  const invitation = await prisma.accountInvitation.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, role: true, status: true, gymId: true, isGymOwner: true } },
    },
  });

  if (!invitation || !invitationIsUsable(invitation, new Date())) {
    return { ok: false, message: "This invitation is invalid, expired, already used or revoked. Ask your gym for a new invitation." };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Keep the same lock order as invitation re-issue: user first, then invitation.
      const lockedUser = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${invitation.user.id}::uuid
          AND "gymId" = ${invitation.gymId}::uuid
        FOR UPDATE
      `;
      if (!lockedUser.length) throw new Error("INVITATION_INVALID");

      const lockedInvitation = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "account_invitations"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;
      if (!lockedInvitation.length) throw new Error("INVITATION_INVALID");

      const current = await tx.accountInvitation.findUnique({
        where: { tokenHash },
        include: {
          user: { select: { id: true, role: true, status: true, gymId: true, isGymOwner: true } },
        },
      });
      if (!current || !invitationIsUsable(current, new Date())) throw new Error("INVITATION_INVALID");

      const updatedUser = await tx.user.updateMany({
        where: {
          id: current.user.id,
          gymId: current.gymId,
          status: UserStatus.INVITED,
        },
        data: { passwordHash, status: UserStatus.ACTIVE },
      });
      if (updatedUser.count !== 1) throw new Error("INVITATION_INVALID");

      await tx.accountInvitation.update({
        where: { id: current.id },
        data: { consumedAt: now },
      });
      await tx.accountInvitation.updateMany({
        where: {
          userId: current.user.id,
          id: { not: current.id },
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      await tx.session.deleteMany({ where: { userId: current.user.id } });
      await tx.auditLog.create({
        data: {
          actorId: current.user.id,
          gymId: current.gymId,
          event: "auth.invitation_accepted",
          resourceType: "user",
          resourceId: current.user.id,
        },
      });
    });
  } catch {
    return { ok: false, message: "This invitation could not be activated. It may have expired or already been used; ask your gym for a new link." };
  }

  redirect("/login?activated=1");
}
