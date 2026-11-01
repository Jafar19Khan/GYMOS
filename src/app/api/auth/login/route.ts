import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Role, UserStatus } from "@prisma/client";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(1)
    .max(128)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password is too long."),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof loginSchema>;

  try {
    payload = loginSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
    select: {
      id: true,
      passwordHash: true,
      role: true,
      status: true,
    },
  });

  if (
    !user ||
    user.status !== UserStatus.ACTIVE ||
    !(await compare(payload.password, user.passwordHash))
  ) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  await createSession(user.id);

  return NextResponse.json({
    ok: true,
    destination:
      user.role === Role.SUPER_ADMIN
        ? "/super-admin"
        : user.role === Role.OWNER
          ? "/owner"
          : "/member",
  });
}
