"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, revokeCurrentSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";

export async function signOutAction() {
  const user = await getCurrentUser();

  if (user) {
    try {
      await recordAuditEvent({
        actorId: user.id,
        gymId: user.gymId,
        event: "auth.logout",
        resourceType: "session",
      });
    } catch {
      console.error("GYMOS could not persist the sign-out audit event.");
    }
  }

  await revokeCurrentSession();
  redirect("/login");
}
