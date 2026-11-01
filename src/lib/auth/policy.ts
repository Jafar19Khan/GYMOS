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
