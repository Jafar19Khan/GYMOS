import { Role } from "@prisma/client";

export function getDashboardPath(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "/super-admin";
    case Role.OWNER:
      return "/owner";
    case Role.MEMBER:
      return "/member";
    default: {
      const exhaustiveRole: never = role;
      return exhaustiveRole;
    }
  }
}
