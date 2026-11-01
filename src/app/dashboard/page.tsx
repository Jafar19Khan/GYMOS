import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardRouter() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === Role.SUPER_ADMIN) redirect("/super-admin");
  if (user.role === Role.OWNER) redirect("/owner");
  redirect("/member");
}
