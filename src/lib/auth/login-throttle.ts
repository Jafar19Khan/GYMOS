import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export { createLoginThrottleKey } from "@/lib/auth/login-throttle-key";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export async function getLoginThrottle(keyHash: string, now = new Date()) {
  const entry = await prisma.loginThrottle.findUnique({
    where: { keyHash },
    select: { attempts: true, lockedUntil: true, windowStartedAt: true },
  });

  if (!entry) return { blocked: false, retryAfterSeconds: 0 };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil.getTime() - now.getTime()) / 1000)),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

export async function recordFailedLogin(keyHash: string, now = new Date()) {
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const lockedUntil = new Date(now.getTime() + LOCK_MS);
  const rows = await prisma.$queryRaw<Array<{ attempts: number; lockedUntil: Date | null }>>`
    INSERT INTO "login_throttles"
      ("id", "keyHash", "attempts", "windowStartedAt", "lockedUntil", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}::uuid, ${keyHash}, 1, ${now}, NULL, ${now}, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attempts" = CASE
        WHEN "login_throttles"."windowStartedAt" <= ${windowStart} THEN 1
        ELSE "login_throttles"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "login_throttles"."windowStartedAt" <= ${windowStart} THEN ${now}
        ELSE "login_throttles"."windowStartedAt"
      END,
      "lockedUntil" = CASE
        WHEN "login_throttles"."windowStartedAt" <= ${windowStart} THEN NULL
        WHEN "login_throttles"."attempts" + 1 >= ${MAX_FAILED_ATTEMPTS} THEN ${lockedUntil}
        ELSE "login_throttles"."lockedUntil"
      END,
      "updatedAt" = ${now}
    RETURNING "attempts", "lockedUntil"
  `;

  const state = rows[0];
  return {
    attempts: state.attempts,
    blocked: Boolean(state.lockedUntil && state.lockedUntil > now),
    retryAfterSeconds: state.lockedUntil && state.lockedUntil > now
      ? Math.max(1, Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000))
      : 0,
  };
}

export async function clearLoginThrottle(keyHash: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { keyHash } });
}
