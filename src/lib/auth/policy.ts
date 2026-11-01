import { Role } from "@prisma/client";
import type { GymPermission } from "@/lib/auth/permissions";

export function isGymPermissionGranted(
  role: Role,
  isGymOwner: boolean,
  assignedPermissions: readonly string[],
  requiredPermission: GymPermission,
): boolean {
  if (role !== Role.OWNER) {
    return false;
  }

  return isGymOwner || assignedPermissions.includes(requiredPermission);
}

export function canDelegateGymPermissions(
  isGymOwner: boolean,
  assignedPermissions: readonly string[],
  requestedPermissions: readonly string[],
): boolean {
  if (isGymOwner) return true;

  const restricted = new Set([
    "staff.manage",
    "members.delete",
    "members.export",
    "settings.manage",
  ]);

  if (requestedPermissions.some((permission) => restricted.has(permission))) {
    return false;
  }

  const assigned = new Set(assignedPermissions);
  return requestedPermissions.every((permission) => assigned.has(permission));
}


export type ManagedStaffStatus = "ACTIVE" | "SUSPENDED" | "INVITED";

export function canTransitionStaffStatus(
  currentStatus: ManagedStaffStatus,
  nextStatus: "ACTIVE" | "SUSPENDED",
): boolean {
  return (
    (currentStatus === "ACTIVE" && nextStatus === "SUSPENDED") ||
    (currentStatus === "SUSPENDED" && nextStatus === "ACTIVE")
  );
}
