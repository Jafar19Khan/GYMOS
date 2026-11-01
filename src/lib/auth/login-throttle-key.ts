import { createHash } from "node:crypto";

export function createLoginThrottleKey(email: string, ipAddress: string): string {
  return createHash("sha256")
    .update(`gymos-login-v1|${email.trim().toLowerCase()}|${ipAddress.slice(0, 100)}`)
    .digest("hex");
}
