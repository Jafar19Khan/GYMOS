import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardPath } from "@/lib/auth/role-routing";

export default async function DashboardRouter() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(getDashboardPath(user.role));
}
