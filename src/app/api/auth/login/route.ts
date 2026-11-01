import { compare } from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getDashboardPath } from "@/lib/auth/role-routing";
import { loginPayloadSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, role: true, status: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE || !(await compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    destination: getDashboardPath(user.role),
  });
}
