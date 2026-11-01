"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { AttendanceMethod, BookingStatus, MembershipStatus, PaymentMethod, PaymentType, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GYM_PERMISSIONS, requireGymPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { canDelegateGymPermissions, canTransitionStaffStatus } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import { parseRupeesToPaise } from "@/lib/operations/money";
import { addCalendarDays, dateOnlyInTimeZone, localDateTimeToUtc } from "@/lib/operations/dates";
import { getClassBookingStatus } from "@/lib/operations/classes";
import { createInvitationToken, hashInvitationToken, INVITATION_TTL_HOURS } from "@/lib/auth/invitations";

export type ActionState = {
  ok: boolean;
  message: string;
  invitationUrl?: string;
};

async function canDelegatePermissions(
  userId: string,
  gymId: string,
  isGymOwner: boolean,
  requested: readonly string[],
): Promise<boolean> {
  if (isGymOwner) return true;

  const ownGrants = await prisma.staffPermission.findMany({
    where: { userId, gymId },
    select: { permission: true },
  });
  return canDelegateGymPermissions(
    false,
    ownGrants.map((grant) => grant.permission),
    requested,
  );
}

async function ownerContext(permission: (typeof GYM_PERMISSIONS)[number]) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.OWNER || !user.gymId) {
    return { ok: false as const, error: "Sign in with an owner or permitted staff account." };
  }

  const gymId = user.gymId;
  try {
    await requireGymPermission(user.id, gymId, permission);
  } catch {
    return { ok: false as const, error: "You do not have permission to perform this action." };
  }

  return { ok: true as const, user, gymId };
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildInvitationUrl(token: string): string {
  const configuredUrl = process.env.APP_URL?.trim();
  if (!configuredUrl) throw new Error("APP_URL is required to issue account invitations.");
  const url = new URL(configuredUrl);
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !localHost) ||
    url.username ||
    url.password
  ) {
    throw new Error("APP_URL must use HTTPS for non-local production hosts.");
  }
  return `${url.origin}/activate?token=${encodeURIComponent(token)}`;
}

const memberSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(24).optional(),
});

export async function createMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("members.write");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = memberSchema.safeParse({
    name: readText(formData, "name"),
    email: readText(formData, "email"),
    phone: readText(formData, "phone") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid name and email address." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return { ok: false, message: "An account with this email already exists." };

  let invitationUrl: string;
  let invitationToken: string;
  try {
    invitationToken = createInvitationToken();
    invitationUrl = buildInvitationUrl(invitationToken);
  } catch {
    return { ok: false, message: "Invitation URL is not configured. Set APP_URL to the public application address before creating accounts." };
  }
  const passwordHash = await hash(randomBytes(48).toString("base64url"), 12);
  const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const member = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: Role.MEMBER,
          status: UserStatus.INVITED,
          gymId: context.gymId,
        },
      });
      await tx.memberProfile.create({
        data: {
          userId: member.id,
          gymId: context.gymId,
          phone: parsed.data.phone || null,
        },
      });
      await tx.accountInvitation.create({
        data: {
          userId: member.id,
          gymId: context.gymId,
          createdById: context.user.id,
          tokenHash: hashInvitationToken(invitationToken),
          expiresAt: invitationExpiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "member.invited",
          resourceType: "user",
          resourceId: member.id,
          metadata: { invitationExpiresAt: invitationExpiresAt.toISOString() },
        },
      });
    });
  } catch {
    return { ok: false, message: "Member could not be created. Check whether the email is already registered." };
  }

  revalidatePath("/owner");
  revalidatePath("/owner/members");
  return { ok: true, message: "Member created. Share this single-use activation link with the member; it expires in 48 hours.", invitationUrl };
}



const memberProfileSchema = z.object({
  memberId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(24).optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(24).optional(),
  dateOfBirth: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
});

export async function updateMemberProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("members.write");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = memberProfileSchema.safeParse({
    memberId: readText(formData, "memberId"),
    name: readText(formData, "name"),
    email: readText(formData, "email"),
    phone: readText(formData, "phone") || undefined,
    emergencyContactName: readText(formData, "emergencyContactName") || undefined,
    emergencyContactPhone: readText(formData, "emergencyContactPhone") || undefined,
    dateOfBirth: readText(formData, "dateOfBirth"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid name, email and profile details." };

  const dateOfBirth = parsed.data.dateOfBirth
    ? new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`)
    : null;
  if (dateOfBirth && (
    Number.isNaN(dateOfBirth.getTime()) ||
    dateOfBirth.toISOString().slice(0, 10) !== parsed.data.dateOfBirth ||
    dateOfBirth > new Date()
  )) {
    return { ok: false, message: "Date of birth must be a valid date that is not in the future." };
  }

  const duplicateEmail = await prisma.user.findFirst({
    where: { email: parsed.data.email, id: { not: parsed.data.memberId } },
    select: { id: true },
  });
  if (duplicateEmail) return { ok: false, message: "Another account already uses this email address." };

  let emailChanged = false;
  let invitationRevoked = false;
  try {
    await prisma.$transaction(async (tx) => {
      const lockedMember = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${parsed.data.memberId}::uuid
          AND "gymId" = ${context.gymId}::uuid
        FOR UPDATE
      `;
      if (!lockedMember.length) throw new Error("MEMBER_NOT_FOUND");

      const member = await tx.user.findFirst({
        where: { id: parsed.data.memberId, gymId: context.gymId, role: Role.MEMBER, status: { not: UserStatus.ARCHIVED } },
        select: { id: true, email: true, status: true },
      });
      if (!member) throw new Error("MEMBER_NOT_FOUND");

      emailChanged = member.email !== parsed.data.email;
      await tx.user.update({
        where: { id: member.id },
        data: { name: parsed.data.name, email: parsed.data.email },
      });
      if (emailChanged) {
        await tx.session.deleteMany({ where: { userId: member.id } });
        if (member.status === UserStatus.INVITED) {
          const revoked = await tx.accountInvitation.updateMany({
            where: { userId: member.id, consumedAt: null, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          invitationRevoked = revoked.count > 0;
        }
      }
      await tx.memberProfile.upsert({
        where: { userId: member.id },
        update: {
          phone: parsed.data.phone || null,
          emergencyContactName: parsed.data.emergencyContactName || null,
          emergencyContactPhone: parsed.data.emergencyContactPhone || null,
          dateOfBirth,
        },
        create: {
          userId: member.id,
          gymId: context.gymId,
          phone: parsed.data.phone || null,
          emergencyContactName: parsed.data.emergencyContactName || null,
          emergencyContactPhone: parsed.data.emergencyContactPhone || null,
          dateOfBirth,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "member.profile.updated",
          resourceType: "user",
          resourceId: member.id,
          metadata: { fields: ["name", "email", "phone", "emergencyContactName", "emergencyContactPhone", "dateOfBirth"] },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return { ok: false, message: "Member not found in your gym." };
    }
    return { ok: false, message: "Profile could not be updated. Check whether the email is already registered." };
  }

  revalidatePath("/owner/members");
  revalidatePath("/owner");
  revalidatePath("/member");
  const message = invitationRevoked
    ? "Member profile updated. The previous activation link was revoked; generate and share a new link."
    : emailChanged
      ? "Member profile updated. Existing sessions were revoked because the email address changed."
      : "Member profile updated.";
  return { ok: true, message };
}

export async function updateMemberStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("members.suspend");
  if (!context.ok) return { ok: false, message: context.error };

  const memberId = readText(formData, "memberId");
  const statusText = readText(formData, "status");
  if (!memberId || !["ACTIVE", "SUSPENDED"].includes(statusText)) {
    return { ok: false, message: "Invalid member status request." };
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, gymId: context.gymId, role: Role.MEMBER },
    select: { id: true, status: true },
  });
  if (!member) return { ok: false, message: "Member not found in your gym." };
  if (member.status === UserStatus.ARCHIVED) return { ok: false, message: "Archived member records cannot be reactivated." };

  const nextStatus = statusText as "ACTIVE" | "SUSPENDED";
  if (member.status === UserStatus.INVITED && nextStatus === UserStatus.ACTIVE) {
    return { ok: false, message: "Invited accounts must activate using their secure invitation link." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: member.id }, data: { status: nextStatus } });
    if (nextStatus === UserStatus.SUSPENDED) {
      await tx.session.deleteMany({ where: { userId: member.id } });
    }
    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        gymId: context.gymId,
        event: nextStatus === UserStatus.SUSPENDED ? "member.suspended" : "member.reactivated",
        resourceType: "user",
        resourceId: member.id,
      },
    });
  });

  revalidatePath("/owner/members");
  revalidatePath("/owner");
  return { ok: true, message: nextStatus === UserStatus.SUSPENDED ? "Member suspended and active sessions revoked." : "Member reactivated." };
}



export async function archiveMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("members.delete");
  if (!context.ok) return { ok: false, message: context.error };

  const memberId = readText(formData, "memberId");
  if (!z.string().uuid().safeParse(memberId).success) {
    return { ok: false, message: "Invalid member record." };
  }

  const anonymizedPasswordHash = await hash(randomBytes(48).toString("base64url"), 12);
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${memberId}::uuid
          AND "gymId" = ${context.gymId}::uuid
        FOR UPDATE
      `;
      if (!locked.length) throw new Error("MEMBER_NOT_FOUND");

      const member = await tx.user.findFirst({
        where: { id: memberId, gymId: context.gymId, role: Role.MEMBER, status: { not: UserStatus.ARCHIVED } },
        select: { id: true },
      });
      if (!member) throw new Error("MEMBER_NOT_FOUND");

      const now = new Date();
      await tx.user.update({
        where: { id: member.id },
        data: {
          name: "Archived member",
          email: `archived+${member.id}@privacy.invalid`,
          passwordHash: anonymizedPasswordHash,
          status: UserStatus.ARCHIVED,
        },
      });
      await tx.memberProfile.updateMany({
        where: { userId: member.id, gymId: context.gymId },
        data: {
          phone: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          dateOfBirth: null,
          healthDataConsent: false,
        },
      });
      await tx.session.deleteMany({ where: { userId: member.id } });
      await tx.accountInvitation.updateMany({
        where: { userId: member.id, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "member.archived",
          resourceType: "user",
          resourceId: member.id,
          metadata: { personalFieldsAnonymized: true, financialAndMembershipRecordsRetained: true },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return { ok: false, message: "Member not found or already archived." };
    }
    return { ok: false, message: "Member could not be archived. Please retry." };
  }

  revalidatePath("/owner/members");
  revalidatePath("/owner");
  return { ok: true, message: "Member archived. Personal profile data and sessions were removed; ledger and membership history were retained for reconciliation." };
}

const staffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  permissions: z.array(z.enum(GYM_PERMISSIONS)).min(1).max(GYM_PERMISSIONS.length),
});

export async function createStaffAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("staff.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = staffSchema.safeParse({
    name: readText(formData, "name"),
    email: readText(formData, "email"),
    permissions: formData.getAll("permissions").filter((value): value is string => typeof value === "string"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid name, email and at least one allowed permission." };
  if (!(await canDelegatePermissions(context.user.id, context.gymId, context.user.isGymOwner, parsed.data.permissions))) {
    return { ok: false, message: "You can only grant permissions you hold; elevated permissions require the primary gym owner." };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return { ok: false, message: "An account with this email already exists." };

  let invitationUrl: string;
  let invitationToken: string;
  try {
    invitationToken = createInvitationToken();
    invitationUrl = buildInvitationUrl(invitationToken);
  } catch {
    return { ok: false, message: "Invitation URL is not configured. Set APP_URL to the public application address before creating accounts." };
  }
  const passwordHash = await hash(randomBytes(48).toString("base64url"), 12);
  const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
  try {
    await prisma.$transaction(async (tx) => {
      const staff = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: Role.OWNER,
          status: UserStatus.INVITED,
          gymId: context.gymId,
          isGymOwner: false,
        },
      });
      await tx.staffPermission.createMany({
        data: parsed.data.permissions.map((permission) => ({
          userId: staff.id,
          gymId: context.gymId,
          permission,
        })),
      });
      await tx.accountInvitation.create({
        data: {
          userId: staff.id,
          gymId: context.gymId,
          createdById: context.user.id,
          tokenHash: hashInvitationToken(invitationToken),
          expiresAt: invitationExpiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "staff.invited",
          resourceType: "user",
          resourceId: staff.id,
          metadata: { permissions: parsed.data.permissions, invitationExpiresAt: invitationExpiresAt.toISOString() },
        },
      });
    });
  } catch {
    return { ok: false, message: "Staff account could not be created. Check whether the email is already registered." };
  }

  revalidatePath("/owner/staff");
  return { ok: true, message: "Staff account created. Share this single-use activation link with the staff member; it expires in 48 hours.", invitationUrl };
}



export async function updateStaffStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("staff.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const staffId = readText(formData, "staffId");
  const statusText = readText(formData, "status");
  if (!z.string().uuid().safeParse(staffId).success || !["ACTIVE", "SUSPENDED"].includes(statusText)) {
    return { ok: false, message: "Invalid staff status request." };
  }

  const nextStatus = statusText as UserStatus;
  try {
    await prisma.$transaction(async (tx) => {
      const lockedStaff = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${staffId}::uuid
          AND "gymId" = ${context.gymId}::uuid
        FOR UPDATE
      `;
      if (!lockedStaff.length) throw new Error("STAFF_NOT_FOUND");

      const staff = await tx.user.findFirst({
        where: { id: staffId, gymId: context.gymId, role: Role.OWNER, isGymOwner: false },
        select: { id: true, status: true },
      });
      if (!staff) throw new Error("STAFF_NOT_FOUND");
      if (staff.id === context.user.id) throw new Error("SELF_STATUS_CHANGE");
      if (!canTransitionStaffStatus(staff.status, nextStatus)) throw new Error("STAFF_STATUS_TRANSITION");

      await tx.user.update({
        where: { id: staff.id },
        data: { status: nextStatus },
      });
      if (nextStatus === UserStatus.SUSPENDED) {
        await tx.session.deleteMany({ where: { userId: staff.id } });
      }
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: nextStatus === UserStatus.SUSPENDED ? "staff.suspended" : "staff.reactivated",
          resourceType: "user",
          resourceId: staff.id,
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      STAFF_NOT_FOUND: "Staff account not found in your gym.",
      SELF_STATUS_CHANGE: "You cannot suspend or reactivate your own account.",
      STAFF_STATUS_TRANSITION: "Only active or suspended staff can be toggled. Invitation-pending staff must use their secure invitation link.",
    };
    return { ok: false, message: messages[reason] ?? "Staff status could not be updated. Please retry." };
  }

  revalidatePath("/owner/staff");
  revalidatePath("/owner");
  return {
    ok: true,
    message: nextStatus === UserStatus.SUSPENDED
      ? "Staff suspended and all active sessions revoked."
      : "Staff reactivated. They can sign in again with their existing password.",
  };
}

export async function updateStaffPermissionsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("staff.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const staffId = readText(formData, "staffId");
  const permissions = formData.getAll("permissions").filter((value): value is string => typeof value === "string");
  const parsedPermissions = z.array(z.enum(GYM_PERMISSIONS)).max(GYM_PERMISSIONS.length).safeParse(permissions);
  if (!staffId || !parsedPermissions.success) return { ok: false, message: "Invalid staff permission request." };
  if (!(await canDelegatePermissions(context.user.id, context.gymId, context.user.isGymOwner, parsedPermissions.data))) {
    return { ok: false, message: "You can only grant permissions you hold; elevated permissions require the primary gym owner." };
  }

  const staff = await prisma.user.findFirst({
    where: { id: staffId, gymId: context.gymId, role: Role.OWNER, isGymOwner: false },
    select: { id: true },
  });
  if (!staff) return { ok: false, message: "Staff account not found in your gym." };

  await prisma.$transaction(async (tx) => {
    await tx.staffPermission.deleteMany({ where: { userId: staff.id, gymId: context.gymId } });
    if (parsedPermissions.data.length) {
      await tx.staffPermission.createMany({
        data: parsedPermissions.data.map((permission) => ({ userId: staff.id, gymId: context.gymId, permission })),
      });
    }
    await tx.session.deleteMany({ where: { userId: staff.id } });
    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        gymId: context.gymId,
        event: "staff.permissions.updated",
        resourceType: "user",
        resourceId: staff.id,
        metadata: { permissions: parsedPermissions.data },
      },
    });
  });

  revalidatePath("/owner/staff");
  return { ok: true, message: "Staff permissions updated." };
}

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  durationDays: z.coerce.number().int().min(1).max(3650),
  price: z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/, "Enter a valid price with up to two decimals."),
});

export async function createMembershipPlanAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("memberships.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = planSchema.safeParse({
    name: readText(formData, "name"),
    description: readText(formData, "description") || undefined,
    durationDays: readText(formData, "durationDays"),
    price: readText(formData, "price"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a plan name, valid duration and price." };

  const pricePaise = parseRupeesToPaise(parsed.data.price);
  if (pricePaise === null) {
    return { ok: false, message: "Plan price must be greater than zero." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const plan = await tx.membershipPlan.create({
        data: {
          gymId: context.gymId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          durationDays: parsed.data.durationDays,
          pricePaise,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "membership_plan.created",
          resourceType: "membership_plan",
          resourceId: plan.id,
        },
      });
    });
  } catch {
    return { ok: false, message: "Could not create plan. Plan names must be unique within your gym." };
  }

  revalidatePath("/owner/plans");
  return { ok: true, message: "Membership plan created." };
}

export async function setMembershipPlanActiveAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("memberships.manage");
  if (!context.ok) return { ok: false, message: context.error };
  const planId = readText(formData, "planId");
  const active = readText(formData, "active") === "true";
  if (!planId) return { ok: false, message: "Invalid plan." };

  const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, gymId: context.gymId }, select: { id: true } });
  if (!plan) return { ok: false, message: "Plan not found in your gym." };

  await prisma.$transaction(async (tx) => {
    await tx.membershipPlan.update({ where: { id: plan.id }, data: { isActive: active } });
    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        gymId: context.gymId,
        event: active ? "membership_plan.activated" : "membership_plan.deactivated",
        resourceType: "membership_plan",
        resourceId: plan.id,
      },
    });
  });

  revalidatePath("/owner/plans");
  return { ok: true, message: active ? "Plan activated." : "Plan deactivated. Existing memberships are unchanged." };
}

const membershipSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function assignMembershipAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("memberships.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = membershipSchema.safeParse({
    memberId: readText(formData, "memberId"),
    planId: readText(formData, "planId"),
    startDate: readText(formData, "startDate"),
  });
  if (!parsed.success) return { ok: false, message: "Choose a member, plan and valid start date." };

  const [member, plan] = await Promise.all([
    prisma.user.findFirst({ where: { id: parsed.data.memberId, gymId: context.gymId, role: Role.MEMBER, status: { not: UserStatus.SUSPENDED } }, select: { id: true } }),
    prisma.membershipPlan.findFirst({ where: { id: parsed.data.planId, gymId: context.gymId, isActive: true }, select: { id: true, durationDays: true } }),
  ]);
  if (!member || !plan) return { ok: false, message: "Member or active plan not found in your gym." };

  const startDateOnly = parsed.data.startDate;
  const startDate = new Date(`${startDateOnly}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || startDate.toISOString().slice(0, 10) !== startDateOnly) {
    return { ok: false, message: "Invalid start date." };
  }
  const endDateOnly = addCalendarDays(startDateOnly, plan.durationDays - 1);
  const endDate = new Date(`${endDateOnly}T00:00:00.000Z`);
  const today = dateOnlyInTimeZone(new Date(), context.user.gym?.timezone ?? "Asia/Kolkata");
  const status = endDateOnly < today
    ? MembershipStatus.EXPIRED
    : startDateOnly > today
      ? MembershipStatus.UPCOMING
      : MembershipStatus.ACTIVE;

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize membership assignments for this member to prevent overlapping rows under concurrent requests.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${member.id}::uuid FOR UPDATE`;

      const overlapping = await tx.membership.findFirst({
        where: {
          gymId: context.gymId,
          memberId: member.id,
          status: { in: [MembershipStatus.ACTIVE, MembershipStatus.UPCOMING, MembershipStatus.FROZEN] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });
      if (overlapping) {
        throw new Error("MEMBERSHIP_OVERLAP");
      }

      const membership = await tx.membership.create({
        data: {
          gymId: context.gymId,
          memberId: member.id,
          planId: plan.id,
          startDate,
          endDate,
          status,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "membership.assigned",
          resourceType: "membership",
          resourceId: membership.id,
          metadata: { memberId: member.id, planId: plan.id },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_OVERLAP") {
      return { ok: false, message: "This member already has a membership overlapping the selected dates." };
    }
    return { ok: false, message: "Membership could not be assigned. Please retry or check the membership record." };
  }

  revalidatePath("/owner");
  revalidatePath("/owner/members");
  revalidatePath("/owner/plans");
  return { ok: true, message: "Membership assigned." };
}

const paymentSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function recordPaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("finance.write");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = paymentSchema.safeParse({
    memberId: readText(formData, "memberId"),
    amount: readText(formData, "amount"),
    method: readText(formData, "method"),
    reference: readText(formData, "reference") || undefined,
    note: readText(formData, "note") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a member, valid amount and payment method." };

  const amountPaise = parseRupeesToPaise(parsed.data.amount);
  if (amountPaise === null) return { ok: false, message: "Payment amount must be greater than zero." };

  const member = await prisma.user.findFirst({
    where: { id: parsed.data.memberId, gymId: context.gymId, role: Role.MEMBER, status: { not: UserStatus.ARCHIVED } },
    select: { id: true },
  });
  if (!member) return { ok: false, message: "Member not found in your gym." };

  const paymentId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        id: paymentId,
        gymId: context.gymId,
        memberId: member.id,
        createdById: context.user.id,
        type: PaymentType.CHARGE,
        method: parsed.data.method,
        amountPaise,
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
        idempotencyKey: randomUUID(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: context.user.id,
        gymId: context.gymId,
        event: "payment.charge_recorded",
        resourceType: "payment",
        resourceId: paymentId,
        metadata: { amountPaise, method: parsed.data.method },
      },
    });
  });

  revalidatePath("/owner");
  revalidatePath("/owner/payments");
  return { ok: true, message: "Payment entry recorded. This records a staff-entered payment; no gateway was charged." };
}


const attendanceSchema = z.object({
  memberId: z.string().uuid(),
  note: z.string().trim().max(300).optional(),
});

export async function recordAttendanceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("attendance.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = attendanceSchema.safeParse({
    memberId: readText(formData, "memberId"),
    note: readText(formData, "note") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Choose a valid member." };

  const timeZone = context.user.gym?.timezone ?? "Asia/Kolkata";
  const today = dateOnlyInTimeZone(new Date(), timeZone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const dayAnchor = todayDate.getTime();
  const rangeStart = new Date(dayAnchor - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(dayAnchor + 48 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const lockedMember = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${parsed.data.memberId}::uuid
          AND "gymId" = ${context.gymId}::uuid
        FOR UPDATE
      `;
      if (!lockedMember.length) throw new Error("MEMBER_NOT_FOUND");

      const member = await tx.user.findFirst({
        where: {
          id: parsed.data.memberId,
          gymId: context.gymId,
          role: Role.MEMBER,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!member) throw new Error("MEMBER_NOT_ACTIVE");

      const activeMembership = await tx.membership.findFirst({
        where: {
          gymId: context.gymId,
          memberId: member.id,
          status: MembershipStatus.ACTIVE,
          startDate: { lte: todayDate },
          endDate: { gte: todayDate },
        },
        select: { id: true },
      });
      if (!activeMembership) throw new Error("NO_ACTIVE_MEMBERSHIP");

      const sameDayRecords = await tx.attendance.findMany({
        where: {
          gymId: context.gymId,
          memberId: member.id,
          checkedInAt: { gte: rangeStart, lt: rangeEnd },
        },
        select: { checkedInAt: true },
      });
      if (sameDayRecords.some((item) => dateOnlyInTimeZone(item.checkedInAt, timeZone) === today)) {
        throw new Error("ALREADY_CHECKED_IN");
      }

      const attendance = await tx.attendance.create({
        data: {
          gymId: context.gymId,
          memberId: member.id,
          recordedById: context.user.id,
          method: AttendanceMethod.MANUAL,
          idempotencyKey: randomUUID(),
          note: parsed.data.note || null,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "attendance.checked_in",
          resourceType: "attendance",
          resourceId: attendance.id,
          metadata: { memberId: member.id, method: AttendanceMethod.MANUAL },
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      MEMBER_NOT_FOUND: "Member not found in your gym.",
      MEMBER_NOT_ACTIVE: "Only active member accounts can be checked in.",
      NO_ACTIVE_MEMBERSHIP: "This member does not have an active membership today.",
      ALREADY_CHECKED_IN: "This member has already checked in today.",
    };
    return { ok: false, message: messages[reason] ?? "Attendance could not be recorded. Please retry." };
  }

  revalidatePath("/owner/attendance");
  revalidatePath("/owner");
  revalidatePath("/member");
  return { ok: true, message: "Attendance recorded." };
}

const gymClassSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  startsAt: z.string().min(1).max(16),
  endsAt: z.string().min(1).max(16),
  capacity: z.coerce.number().int().min(1).max(200),
});

export async function createGymClassAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("classes.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = gymClassSchema.safeParse({
    name: readText(formData, "name"),
    description: readText(formData, "description") || undefined,
    startsAt: readText(formData, "startsAt"),
    endsAt: readText(formData, "endsAt"),
    capacity: readText(formData, "capacity"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a class name, valid schedule and capacity from 1 to 200." };

  const timeZone = context.user.gym?.timezone ?? "Asia/Kolkata";
  const startsAt = localDateTimeToUtc(parsed.data.startsAt, timeZone);
  const endsAt = localDateTimeToUtc(parsed.data.endsAt, timeZone);
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    return { ok: false, message: "Class times must be valid gym-local times and the end must be after the start." };
  }
  if (startsAt <= new Date()) {
    return { ok: false, message: "A new class must be scheduled in the future." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const gymClass = await tx.gymClass.create({
        data: {
          gymId: context.gymId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          startsAt,
          endsAt,
          capacity: parsed.data.capacity,
          isPublished: true,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "class.created",
          resourceType: "gym_class",
          resourceId: gymClass.id,
          metadata: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), capacity: parsed.data.capacity },
        },
      });
    });
  } catch {
    return { ok: false, message: "Class could not be scheduled. Please retry." };
  }

  revalidatePath("/owner/classes");
  revalidatePath("/member/classes");
  return { ok: true, message: "Class scheduled and published for member booking." };
}

const classBookingSchema = z.object({ classId: z.string().uuid() });

export async function bookGymClassAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.MEMBER || !user.gymId) {
    return { ok: false, message: "Sign in with an active member account to book a class." };
  }

  const gymId = user.gymId;
  const parsed = classBookingSchema.safeParse({ classId: readText(formData, "classId") });
  if (!parsed.success) return { ok: false, message: "Select a valid class." };
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";
  const today = dateOnlyInTimeZone(new Date(), timeZone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const membership = await prisma.membership.findFirst({
    where: {
      gymId: gymId,
      memberId: user.id,
      status: MembershipStatus.ACTIVE,
      startDate: { lte: todayDate },
      endDate: { gte: todayDate },
    },
    select: { id: true },
  });
  if (!membership) return { ok: false, message: "An active membership is required to book classes." };

  try {
    await prisma.$transaction(async (tx) => {
      const lockedClass = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "gym_classes"
        WHERE "id" = ${parsed.data.classId}::uuid
          AND "gymId" = ${gymId}::uuid
        FOR UPDATE
      `;
      if (!lockedClass.length) throw new Error("CLASS_NOT_FOUND");

      const gymClass = await tx.gymClass.findFirst({
        where: { id: parsed.data.classId, gymId: gymId, isPublished: true, startsAt: { gt: new Date() } },
        select: { id: true, capacity: true },
      });
      if (!gymClass) throw new Error("CLASS_NOT_AVAILABLE");

      const existing = await tx.classBooking.findUnique({
        where: { classId_memberId: { classId: gymClass.id, memberId: user.id } },
        select: { id: true, status: true },
      });
      if (existing && existing.status !== BookingStatus.CANCELLED) throw new Error("ALREADY_BOOKED");

      const bookedCount = await tx.classBooking.count({
        where: { classId: gymClass.id, status: BookingStatus.BOOKED },
      });
      const status = getClassBookingStatus(gymClass.capacity, bookedCount);
      if (existing) {
        await tx.classBooking.update({
          where: { id: existing.id },
          data: { status, createdAt: new Date() },
        });
      } else {
        await tx.classBooking.create({
          data: { gymId: gymId, classId: gymClass.id, memberId: user.id, status },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          gymId: gymId,
          event: status === BookingStatus.BOOKED ? "class.booking_confirmed" : "class.waitlisted",
          resourceType: "gym_class",
          resourceId: gymClass.id,
          metadata: { memberId: user.id },
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      CLASS_NOT_FOUND: "Class not found.",
      CLASS_NOT_AVAILABLE: "This class is no longer open for booking.",
      ALREADY_BOOKED: "You already have an active booking or waitlist entry for this class.",
    };
    return { ok: false, message: messages[reason] ?? "Class booking failed. Please retry." };
  }

  revalidatePath("/member/classes");
  revalidatePath("/member");
  return { ok: true, message: "Your class booking has been saved. Check the status below." };
}

export async function cancelGymClassBookingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.MEMBER || !user.gymId) {
    return { ok: false, message: "Sign in with an active member account to manage bookings." };
  }

  const gymId = user.gymId;
  const parsed = classBookingSchema.safeParse({ classId: readText(formData, "classId") });
  if (!parsed.success) return { ok: false, message: "Select a valid class." };

  try {
    await prisma.$transaction(async (tx) => {
      const lockedClass = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "gym_classes"
        WHERE "id" = ${parsed.data.classId}::uuid
          AND "gymId" = ${gymId}::uuid
        FOR UPDATE
      `;
      if (!lockedClass.length) throw new Error("CLASS_NOT_FOUND");

      const gymClass = await tx.gymClass.findFirst({
        where: { id: parsed.data.classId, gymId: gymId, startsAt: { gt: new Date() } },
        select: { id: true },
      });
      if (!gymClass) throw new Error("CLASS_ALREADY_STARTED");

      const booking = await tx.classBooking.findUnique({
        where: { classId_memberId: { classId: gymClass.id, memberId: user.id } },
        select: { id: true, status: true },
      });
      if (!booking || (booking.status !== BookingStatus.BOOKED && booking.status !== BookingStatus.WAITLISTED)) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      await tx.classBooking.update({ where: { id: booking.id }, data: { status: BookingStatus.CANCELLED } });

      if (booking.status === BookingStatus.BOOKED) {
        const nextInLine = await tx.classBooking.findFirst({
          where: { gymId: gymId, classId: gymClass.id, status: BookingStatus.WAITLISTED },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, memberId: true },
        });
        if (nextInLine) {
          await tx.classBooking.update({ where: { id: nextInLine.id }, data: { status: BookingStatus.BOOKED } });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              gymId: gymId,
              event: "class.waitlist_promoted",
              resourceType: "class_booking",
              resourceId: nextInLine.id,
              metadata: { classId: gymClass.id, memberId: nextInLine.memberId },
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          gymId: gymId,
          event: "class.booking_cancelled",
          resourceType: "class_booking",
          resourceId: booking.id,
          metadata: { classId: gymClass.id, previousStatus: booking.status },
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      CLASS_NOT_FOUND: "Class not found.",
      CLASS_ALREADY_STARTED: "A class that has started can no longer be cancelled.",
      BOOKING_NOT_FOUND: "No active booking was found for this class.",
    };
    return { ok: false, message: messages[reason] ?? "Booking could not be cancelled. Please retry." };
  }

  revalidatePath("/member/classes");
  revalidatePath("/member");
  return { ok: true, message: "Booking cancelled. Any released place has been offered to the earliest waitlisted member." };
}


export async function issueAccountInvitationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const targetId = readText(formData, "targetId");
  const accountType = readText(formData, "accountType");
  if (!z.string().uuid().safeParse(targetId).success || !["MEMBER", "STAFF"].includes(accountType)) {
    return { ok: false, message: "Invalid invitation request." };
  }

  const context = await ownerContext(accountType === "MEMBER" ? "members.write" : "staff.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const userWhere = accountType === "MEMBER"
    ? { id: targetId, gymId: context.gymId, role: Role.MEMBER }
    : { id: targetId, gymId: context.gymId, role: Role.OWNER, isGymOwner: false };
  const target = await prisma.user.findFirst({
    where: userWhere,
    select: { id: true, status: true },
  });
  if (!target || target.status !== UserStatus.INVITED) {
    return { ok: false, message: "Only an invitation-pending account in your gym can receive a new link." };
  }

  let invitationUrl: string;
  let invitationToken: string;
  try {
    invitationToken = createInvitationToken();
    invitationUrl = buildInvitationUrl(invitationToken);
  } catch {
    return { ok: false, message: "Invitation URL is not configured. Set APP_URL to the public application address." };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${target.id}::uuid AND "gymId" = ${context.gymId}::uuid
        FOR UPDATE
      `;
      if (!locked.length) throw new Error("INVITATION_TARGET_MISSING");

      const current = await tx.user.findFirst({
        where: { ...userWhere, status: UserStatus.INVITED },
        select: { id: true },
      });
      if (!current) throw new Error("INVITATION_TARGET_CHANGED");

      await tx.accountInvitation.updateMany({
        where: { userId: target.id, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.accountInvitation.create({
        data: {
          userId: target.id,
          gymId: context.gymId,
          createdById: context.user.id,
          tokenHash: hashInvitationToken(invitationToken),
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "account_invitation.issued",
          resourceType: "user",
          resourceId: target.id,
          metadata: { accountType, expiresAt: expiresAt.toISOString() },
        },
      });
    });
  } catch {
    return { ok: false, message: "A new invitation could not be generated. Refresh and try again." };
  }

  revalidatePath(accountType === "MEMBER" ? "/owner/members" : "/owner/staff");
  return { ok: true, message: "New 48-hour activation link generated. Previous unused links are revoked; share this link only with the intended recipient.", invitationUrl };
}


const ledgerCorrectionSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/),
  note: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(120).optional(),
});

export async function recordRefundAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("finance.refund");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = ledgerCorrectionSchema.extend({
    method: z.nativeEnum(PaymentMethod),
  }).safeParse({
    paymentId: readText(formData, "paymentId"),
    amount: readText(formData, "amount"),
    method: readText(formData, "method"),
    note: readText(formData, "note"),
    reference: readText(formData, "reference") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid refund amount, return method and reason." };

  const amountPaise = parseRupeesToPaise(parsed.data.amount);
  if (amountPaise === null) return { ok: false, message: "Refund amount must be greater than zero." };

  const refundId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      const lockedCharge = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "payments"
        WHERE "id" = ${parsed.data.paymentId}::uuid
          AND "gymId" = ${context.gymId}::uuid
          AND "type" = 'CHARGE'::"PaymentType"
        FOR UPDATE
      `;
      if (!lockedCharge.length) throw new Error("CHARGE_NOT_FOUND");

      const charge = await tx.payment.findFirst({
        where: { id: parsed.data.paymentId, gymId: context.gymId, type: PaymentType.CHARGE },
        select: { id: true, memberId: true, amountPaise: true },
      });
      if (!charge) throw new Error("CHARGE_NOT_FOUND");

      const [refunds, adjustments] = await Promise.all([
        tx.payment.aggregate({
          where: { relatedPaymentId: charge.id, type: PaymentType.REFUND },
          _sum: { amountPaise: true },
        }),
        tx.payment.aggregate({
          where: { relatedPaymentId: charge.id, type: PaymentType.ADJUSTMENT },
          _sum: { amountPaise: true },
        }),
      ]);
      const outstanding = charge.amountPaise
        + (adjustments._sum.amountPaise ?? 0)
        - (refunds._sum.amountPaise ?? 0);
      if (amountPaise > outstanding) throw new Error("REFUND_EXCEEDS_BALANCE");

      await tx.payment.create({
        data: {
          id: refundId,
          gymId: context.gymId,
          memberId: charge.memberId,
          createdById: context.user.id,
          type: PaymentType.REFUND,
          method: parsed.data.method,
          amountPaise,
          relatedPaymentId: charge.id,
          reference: parsed.data.reference || null,
          note: parsed.data.note,
          idempotencyKey: randomUUID(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "payment.refund_recorded",
          resourceType: "payment",
          resourceId: refundId,
          metadata: { relatedPaymentId: charge.id, amountPaise, method: parsed.data.method },
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      CHARGE_NOT_FOUND: "Original charge was not found in this gym.",
      REFUND_EXCEEDS_BALANCE: "Refund exceeds the remaining refundable amount for this charge.",
    };
    return { ok: false, message: messages[reason] ?? "Refund could not be recorded. Please retry." };
  }

  revalidatePath("/owner/payments");
  revalidatePath("/owner");
  revalidatePath("/member/payments");
  revalidatePath("/member");
  return { ok: true, message: "Refund recorded as a separate ledger entry. The original charge remains unchanged." };
}

export async function recordAdjustmentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("finance.refund");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = ledgerCorrectionSchema.extend({
    direction: z.enum(["INCREASE", "DECREASE"]),
  }).safeParse({
    paymentId: readText(formData, "paymentId"),
    amount: readText(formData, "amount"),
    direction: readText(formData, "direction"),
    note: readText(formData, "note"),
    reference: readText(formData, "reference") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid adjustment amount, direction and reason." };

  const parsedAmount = parseRupeesToPaise(parsed.data.amount);
  if (parsedAmount === null) return { ok: false, message: "Adjustment amount must be greater than zero." };
  const amountPaise = parsed.data.direction === "DECREASE" ? -parsedAmount : parsedAmount;
  const adjustmentId = randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      const lockedCharge = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "payments"
        WHERE "id" = ${parsed.data.paymentId}::uuid
          AND "gymId" = ${context.gymId}::uuid
          AND "type" = 'CHARGE'::"PaymentType"
        FOR UPDATE
      `;
      if (!lockedCharge.length) throw new Error("CHARGE_NOT_FOUND");

      const charge = await tx.payment.findFirst({
        where: { id: parsed.data.paymentId, gymId: context.gymId, type: PaymentType.CHARGE },
        select: { id: true, memberId: true, amountPaise: true, method: true },
      });
      if (!charge) throw new Error("CHARGE_NOT_FOUND");

      const [refunds, adjustments] = await Promise.all([
        tx.payment.aggregate({
          where: { relatedPaymentId: charge.id, type: PaymentType.REFUND },
          _sum: { amountPaise: true },
        }),
        tx.payment.aggregate({
          where: { relatedPaymentId: charge.id, type: PaymentType.ADJUSTMENT },
          _sum: { amountPaise: true },
        }),
      ]);
      const currentBalance = charge.amountPaise
        + (adjustments._sum.amountPaise ?? 0)
        - (refunds._sum.amountPaise ?? 0);
      if (amountPaise < 0 && Math.abs(amountPaise) > currentBalance) {
        throw new Error("ADJUSTMENT_EXCEEDS_BALANCE");
      }

      await tx.payment.create({
        data: {
          id: adjustmentId,
          gymId: context.gymId,
          memberId: charge.memberId,
          createdById: context.user.id,
          type: PaymentType.ADJUSTMENT,
          method: charge.method,
          amountPaise,
          relatedPaymentId: charge.id,
          reference: parsed.data.reference || null,
          note: parsed.data.note,
          idempotencyKey: randomUUID(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "payment.adjustment_recorded",
          resourceType: "payment",
          resourceId: adjustmentId,
          metadata: { relatedPaymentId: charge.id, amountPaise, direction: parsed.data.direction },
        },
      });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      CHARGE_NOT_FOUND: "Original charge was not found in this gym.",
      ADJUSTMENT_EXCEEDS_BALANCE: "A decrease cannot exceed the remaining balance of this charge.",
    };
    return { ok: false, message: messages[reason] ?? "Adjustment could not be recorded. Please retry." };
  }

  revalidatePath("/owner/payments");
  revalidatePath("/owner");
  revalidatePath("/member/payments");
  revalidatePath("/member");
  return { ok: true, message: "Adjustment recorded as a separate signed ledger entry." };
}


const workoutPlanSchema = z.object({
  memberId: z.string().uuid(),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  exerciseInstructions: z.string().trim().min(2).max(4000),
});

export async function createWorkoutPlanAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("fitness.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = workoutPlanSchema.safeParse({
    memberId: readText(formData, "memberId"),
    title: readText(formData, "title"),
    description: readText(formData, "description") || undefined,
    exerciseInstructions: readText(formData, "exerciseInstructions"),
  });
  if (!parsed.success) return { ok: false, message: "Choose an active member and enter a workout plan." };

  const member = await prisma.user.findFirst({
    where: { id: parsed.data.memberId, gymId: context.gymId, role: Role.MEMBER, status: UserStatus.ACTIVE },
    select: { id: true },
  });
  if (!member) return { ok: false, message: "Active member not found in this gym." };

  const planId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workoutPlan.create({
        data: {
          id: planId,
          gymId: context.gymId,
          memberId: member.id,
          createdById: context.user.id,
          title: parsed.data.title,
          description: parsed.data.description || null,
          exerciseInstructions: parsed.data.exerciseInstructions,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "fitness.workout_plan_assigned",
          resourceType: "workout_plan",
          resourceId: planId,
          metadata: { memberId: member.id },
        },
      });
    });
  } catch {
    return { ok: false, message: "Workout plan could not be assigned. Please retry." };
  }

  revalidatePath("/owner/fitness");
  revalidatePath("/member/fitness");
  return { ok: true, message: "Workout plan assigned to the member." };
}

const dietPlanSchema = z.object({
  memberId: z.string().uuid(),
  title: z.string().trim().min(2).max(100),
  targetCalories: z.coerce.number().int().min(500).max(10000),
  proteinGrams: z.coerce.number().int().min(0).max(500),
  carbsGrams: z.coerce.number().int().min(0).max(1000),
  fatGrams: z.coerce.number().int().min(0).max(500),
  notes: z.string().trim().max(2000).optional(),
});

export async function createDietPlanAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("fitness.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = dietPlanSchema.safeParse({
    memberId: readText(formData, "memberId"),
    title: readText(formData, "title"),
    targetCalories: readText(formData, "targetCalories"),
    proteinGrams: readText(formData, "proteinGrams"),
    carbsGrams: readText(formData, "carbsGrams"),
    fatGrams: readText(formData, "fatGrams"),
    notes: readText(formData, "notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter valid diet targets and select an active member." };

  const member = await prisma.user.findFirst({
    where: { id: parsed.data.memberId, gymId: context.gymId, role: Role.MEMBER, status: UserStatus.ACTIVE },
    select: { id: true },
  });
  if (!member) return { ok: false, message: "Active member not found in this gym." };

  const dietPlanId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.dietPlan.create({
        data: {
          id: dietPlanId,
          gymId: context.gymId,
          memberId: member.id,
          createdById: context.user.id,
          title: parsed.data.title,
          targetCalories: parsed.data.targetCalories,
          proteinGrams: parsed.data.proteinGrams,
          carbsGrams: parsed.data.carbsGrams,
          fatGrams: parsed.data.fatGrams,
          notes: parsed.data.notes || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "fitness.diet_plan_assigned",
          resourceType: "diet_plan",
          resourceId: dietPlanId,
          metadata: { memberId: member.id, targetCalories: parsed.data.targetCalories },
        },
      });
    });
  } catch {
    return { ok: false, message: "Diet plan could not be assigned. Please retry." };
  }

  revalidatePath("/owner/fitness");
  revalidatePath("/member/fitness");
  return { ok: true, message: "Diet targets assigned. These are general fitness targets, not medical advice." };
}

const workoutSessionSchema = z.object({
  planId: z.string().uuid(),
  durationMinutes: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function logWorkoutSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.MEMBER || !user.gymId) {
    return { ok: false, message: "Sign in with a member account to log a workout." };
  }
  const parsed = workoutSessionSchema.safeParse({
    planId: readText(formData, "planId"),
    durationMinutes: readText(formData, "durationMinutes"),
    notes: readText(formData, "notes") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Choose a valid workout plan and session duration." };
  const durationMinutes = parsed.data.durationMinutes ? Number(parsed.data.durationMinutes) : null;
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600)) {
    return { ok: false, message: "Workout duration must be between 1 and 600 minutes." };
  }

  const plan = await prisma.workoutPlan.findFirst({
    where: { id: parsed.data.planId, gymId: user.gymId, memberId: user.id, isActive: true },
    select: { id: true },
  });
  if (!plan) return { ok: false, message: "Workout plan not found in your account." };

  const sessionId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.workoutSession.create({
      data: {
        id: sessionId,
        gymId: user.gymId!,
        memberId: user.id,
        workoutPlanId: plan.id,
        durationMinutes,
        notes: parsed.data.notes || null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        gymId: user.gymId,
        event: "fitness.workout_completed",
        resourceType: "workout_session",
        resourceId: sessionId,
        metadata: { workoutPlanId: plan.id, durationMinutes },
      },
    });
  });

  revalidatePath("/member/fitness");
  revalidatePath("/member");
  revalidatePath("/owner/fitness");
  return { ok: true, message: "Workout session logged." };
}

const progressEntrySchema = z.object({
  metric: z.enum(["WEIGHT_KG", "BODY_FAT_PERCENT", "WAIST_CM", "CHEST_CM"]),
  value: z.coerce.number().positive().finite(),
  note: z.string().trim().max(300).optional(),
});

export async function recordFitnessProgressAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.MEMBER || !user.gymId) {
    return { ok: false, message: "Sign in with a member account to record progress." };
  }
  const parsed = progressEntrySchema.safeParse({
    metric: readText(formData, "metric"),
    value: readText(formData, "value"),
    note: readText(formData, "note") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid measurement." };

  const units: Record<typeof parsed.data.metric, string> = {
    WEIGHT_KG: "kg",
    BODY_FAT_PERCENT: "%",
    WAIST_CM: "cm",
    CHEST_CM: "cm",
  };
  const bounds: Record<typeof parsed.data.metric, number> = {
    WEIGHT_KG: 500,
    BODY_FAT_PERCENT: 100,
    WAIST_CM: 300,
    CHEST_CM: 300,
  };
  if (parsed.data.value > bounds[parsed.data.metric]) {
    return { ok: false, message: "Measurement is outside the supported range." };
  }

  await prisma.progressEntry.create({
    data: {
      gymId: user.gymId,
      memberId: user.id,
      recordedById: user.id,
      metric: parsed.data.metric,
      value: parsed.data.value,
      unit: units[parsed.data.metric],
      note: parsed.data.note || null,
    },
  });
  revalidatePath("/member/fitness");
  revalidatePath("/member");
  revalidatePath("/owner/fitness");
  return { ok: true, message: "Progress entry saved." };
}

const announcementSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  audience: z.enum(["MEMBERS", "ALL"]),
});

export async function createAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("cms.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = announcementSchema.safeParse({
    title: readText(formData, "title"),
    body: readText(formData, "body"),
    audience: readText(formData, "audience"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a title, message and audience." };

  const announcement = await prisma.announcement.create({
    data: {
      gymId: context.gymId,
      createdById: context.user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      audience: parsed.data.audience,
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: context.user.id,
      gymId: context.gymId,
      event: "announcement.published",
      resourceType: "announcement",
      resourceId: announcement.id,
      metadata: { audience: parsed.data.audience },
    },
  });

  revalidatePath("/owner/announcements");
  revalidatePath("/member");
  revalidatePath("/member/announcements");
  return { ok: true, message: "Announcement published." };
}

const websiteSchema = z.object({
  heroTitle: z.string().trim().min(2).max(100),
  heroSubtitle: z.string().trim().min(2).max(300),
  aboutText: z.string().trim().min(2).max(2000),
  facilitiesText: z.string().trim().max(1500),
  address: z.string().trim().max(300).optional(),
  contactEmail: z.union([z.literal(""), z.string().email().max(254)]).optional(),
  contactPhone: z.string().trim().max(24).optional(),
});

export async function updateGymWebsiteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("cms.manage");
  if (!context.ok) return { ok: false, message: context.error };

  const parsed = websiteSchema.safeParse({
    heroTitle: readText(formData, "heroTitle"),
    heroSubtitle: readText(formData, "heroSubtitle"),
    aboutText: readText(formData, "aboutText"),
    facilitiesText: readText(formData, "facilitiesText"),
    address: readText(formData, "address") || undefined,
    contactEmail: readText(formData, "contactEmail"),
    contactPhone: readText(formData, "contactPhone") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter valid website content and contact information." };

  const isPublished = readText(formData, "isPublished") === "on";
  await prisma.gymWebsite.upsert({
    where: { gymId: context.gymId },
    update: { ...parsed.data, isPublished },
    create: { gymId: context.gymId, ...parsed.data, isPublished },
  });
  await prisma.auditLog.create({
    data: {
      actorId: context.user.id,
      gymId: context.gymId,
      event: isPublished ? "website.published" : "website.updated",
      resourceType: "gym_website",
      metadata: { isPublished },
    },
  });

  revalidatePath("/owner/website");
  revalidatePath(`/gym/${context.user.gym?.slug ?? ""}`);
  return { ok: true, message: isPublished ? "Gym website content published." : "Website content saved as draft." };
}
