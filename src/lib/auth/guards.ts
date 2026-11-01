import "server-only";

import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export async function requireRole(role: Role) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== role) {
    redirect("/dashboard");
  }

  return user;
}
