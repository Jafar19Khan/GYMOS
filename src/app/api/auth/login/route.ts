import { compare } from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getDashboardPath } from "@/lib/auth/role-routing";
import { loginPayloadSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { clearLoginThrottle, createLoginThrottleKey, getLoginThrottle, recordFailedLogin } from "@/lib/auth/login-throttle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const parsed = loginPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  // Only trust forwarding headers when the deployment proxy strips client values and writes its own.
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  const forwardedFor = trustProxyHeaders ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  const realIp = trustProxyHeaders ? request.headers.get("x-real-ip")?.trim() : undefined;
  const ipAddress = forwardedFor || realIp || "unknown";
  const throttleKey = createLoginThrottleKey(parsed.data.email, ipAddress);
  const throttle = await getLoginThrottle(throttleKey);
  if (throttle.blocked) {
    return NextResponse.json(
      { error: "Too many failed sign-in attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, role: true, status: true, gymId: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE || !(await compare(parsed.data.password, user.passwordHash))) {
    const failedAttempt = await recordFailedLogin(throttleKey);
    if (failedAttempt.blocked) {
      return NextResponse.json(
        { error: "Too many failed sign-in attempts. Try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(failedAttempt.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  await clearLoginThrottle(throttleKey);
  await createSession(user.id);
  try {
    await recordAuditEvent({ actorId: user.id, gymId: user.gymId, event: "auth.login", resourceType: "session" });
  } catch {
    console.error("GYMOS could not persist the successful-login audit event.");
  }

  return NextResponse.json({
    ok: true,
    destination: getDashboardPath(user.role),
  });
}
