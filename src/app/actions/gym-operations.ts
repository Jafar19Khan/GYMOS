"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { MembershipStatus, PaymentMethod, PaymentType, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GYM_PERMISSIONS, requireGymPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { canDelegateGymPermissions } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import { parseRupeesToPaise } from "@/lib/operations/money";

export type ActionState = {
  ok: boolean;
  message: string;
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
    return { error: "Sign in with an owner or permitted staff account." } as const;
  }

  try {
    await requireGymPermission(user.id, user.gymId, permission);
  } catch {
    return { error: "You do not have permission to perform this action." } as const;
  }

  return { user, gymId: user.gymId } as const;
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  if ("error" in context) return { ok: false, message: context.error };

  const parsed = memberSchema.safeParse({
    name: readText(formData, "name"),
    email: readText(formData, "email"),
    phone: readText(formData, "phone") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid name and email address." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return { ok: false, message: "An account with this email already exists." };

  const temporarySecret = randomBytes(48).toString("base64url");
  const passwordHash = await hash(temporarySecret, 12);

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
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "member.invited",
          resourceType: "user",
          resourceId: member.id,
        },
      });
    });
  } catch {
    return { ok: false, message: "Member could not be created. Check whether the email is already registered." };
  }

  revalidatePath("/owner");
  revalidatePath("/owner/members");
  return { ok: true, message: "Member record created as INVITED. Account activation/invitation delivery is not enabled yet." };
}

export async function updateMemberStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("members.suspend");
  if ("error" in context) return { ok: false, message: context.error };

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

  const nextStatus = statusText as UserStatus;
  if (member.status === UserStatus.INVITED && nextStatus === UserStatus.ACTIVE) {
    return { ok: false, message: "Invited accounts cannot be activated until the secure invitation flow is implemented." };
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
  if ("error" in context) return { ok: false, message: context.error };

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

  const passwordHash = await hash(randomBytes(48).toString("base64url"), 12);
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
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          gymId: context.gymId,
          event: "staff.invited",
          resourceType: "user",
          resourceId: staff.id,
          metadata: { permissions: parsed.data.permissions },
        },
      });
    });
  } catch {
    return { ok: false, message: "Staff account could not be created. Check whether the email is already registered." };
  }

  revalidatePath("/owner/staff");
  return { ok: true, message: "Staff account created as INVITED with the selected permissions. Login activation is not yet enabled." };
}

export async function updateStaffPermissionsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await ownerContext("staff.manage");
  if ("error" in context) return { ok: false, message: context.error };

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
  if ("error" in context) return { ok: false, message: context.error };

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
  if ("error" in context) return { ok: false, message: context.error };
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
  if ("error" in context) return { ok: false, message: context.error };

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

  const startDate = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime())) return { ok: false, message: "Invalid start date." };
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + plan.durationDays - 1);
  const now = new Date();
  const status = startDate <= new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    ? MembershipStatus.ACTIVE
    : MembershipStatus.UPCOMING;

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
  if ("error" in context) return { ok: false, message: context.error };

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
    where: { id: parsed.data.memberId, gymId: context.gymId, role: Role.MEMBER },
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
