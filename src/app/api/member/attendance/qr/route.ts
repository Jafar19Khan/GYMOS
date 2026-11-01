import { MembershipStatus, Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAttendanceQrToken } from "@/lib/auth/attendance-qr";
import { dateOnlyInTimeZone } from "@/lib/operations/dates";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.MEMBER || !user.gymId) {
    return NextResponse.json({ error: "Member sign-in required." }, { status: 401 });
  }
  const secret = process.env.ATTENDANCE_QR_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    return NextResponse.json({ error: "QR attendance is not configured. Contact the gym administrator." }, { status: 503 });
  }

  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";
  const today = dateOnlyInTimeZone(new Date(), timeZone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const membership = await prisma.membership.findFirst({
    where: {
      gymId: user.gymId,
      memberId: user.id,
      status: MembershipStatus.ACTIVE,
      startDate: { lte: todayDate },
      endDate: { gte: todayDate },
    },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "An active membership is required for QR check-in." }, { status: 403 });
  }

  const token = createAttendanceQrToken(user.gymId, user.id, secret);
  return NextResponse.json(
    { token, expiresInSeconds: 60 },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
