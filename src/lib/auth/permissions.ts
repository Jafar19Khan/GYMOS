import "server-only";

import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const GYM_PERMISSIONS = [
  "dashboard.read",
  "members.read",
  "members.write",
  "members.suspend",
  "members.export",
  "members.delete",
  "staff.read",
  "staff.manage",
  "memberships.read",
  "memberships.manage",
  "attendance.read",
  "attendance.manage",
  "classes.read",
  "classes.manage",
  "finance.read",
  "finance.write",
  "finance.refund",
  "reports.read",
  "cms.manage",
  "media.manage",
  "settings.manage",
] as const;

export type GymPermission = (typeof GYM_PERMISSIONS)[number];

export async function hasGymPermission(
  userId: string,
  gymId: string,
  permission: GymPermission,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, gymId: true, isGymOwner: true },
  });

  if (!user || user.role !== Role.OWNER || user.gymId !== gymId) {
    return false;
  }

  if (user.isGymOwner) {
    return true;
  }

  const grant = await prisma.staffPermission.findFirst({
    where: { userId, gymId, permission },
    select: { id: true },
  });

  return Boolean(grant);
}

export async function requireGymPermission(
  userId: string,
  gymId: string,
  permission: GymPermission,
): Promise<void> {
  const allowed = await hasGymPermission(userId, gymId, permission);

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
}
