"use server";

import { redirect } from "next/navigation";
import { revokeCurrentSession } from "@/lib/auth/session";

export async function signOutAction() {
  await revokeCurrentSession();
  redirect("/login");
}
