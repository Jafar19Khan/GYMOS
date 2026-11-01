import { AttendanceMethod, MembershipStatus, Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasGymPermission } from "@/lib/auth/permissions";
import { verifyAttendanceQrToken } from "@/lib/auth/attendance-qr";
import { dateOnlyInTimeZone } from "@/lib/operations/dates";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== Role.OWNER || !actor.gymId) {
    return NextResponse.json({ error: "Owner or permitted staff sign-in required." }, { status: 401 });
  }
  if (!(await hasGymPermission(actor.id, actor.gymId, "attendance.manage"))) {
    return NextResponse.json({ error: "Attendance management permission required." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid QR scan payload." }, { status: 400 });
  }
  const token = body && typeof body === "object" && "token" in body && typeof body.token === "string"
    ? body.token
    : "";
  const secret = process.env.ATTENDANCE_QR_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    return NextResponse.json({ error: "QR attendance is not configured." }, { status: 503 });
  }
  const payload = verifyAttendanceQrToken(token, secret);
  if (!payload || payload.gymId !== actor.gymId) {
    return NextResponse.json({ error: "QR code is invalid, expired or belongs to another gym." }, { status: 400 });
  }

  const timeZone = actor.gym?.timezone ?? "Asia/Kolkata";
  const today = dateOnlyInTimeZone(new Date(), timeZone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const dayAnchor = todayDate.getTime();
  const rangeStart = new Date(dayAnchor - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(dayAnchor + 48 * 60 * 60 * 1000);
  const attendanceId = payload.nonce;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users"
        WHERE "id" = ${payload.memberId}::uuid
          AND "gymId" = ${actor.gymId}::uuid
        FOR UPDATE
      `;
      if (!locked.length) throw new Error("MEMBER_NOT_FOUND");

      const member = await tx.user.findFirst({
        where: { id: payload.memberId, gymId: actor.gymId, role: Role.MEMBER, status: UserStatus.ACTIVE },
        select: { id: true, name: true },
      });
      if (!member) throw new Error("MEMBER_NOT_ACTIVE");

      const membership = await tx.membership.findFirst({
        where: {
          gymId: actor.gymId,
          memberId: member.id,
          status: MembershipStatus.ACTIVE,
          startDate: { lte: todayDate },
          endDate: { gte: todayDate },
        },
        select: { id: true },
      });
      if (!membership) throw new Error("NO_ACTIVE_MEMBERSHIP");

      const priorRecords = await tx.attendance.findMany({
        where: { gymId: actor.gymId, memberId: member.id, checkedInAt: { gte: rangeStart, lt: rangeEnd } },
        select: { checkedInAt: true },
      });
      if (priorRecords.some((item) => dateOnlyInTimeZone(item.checkedInAt, timeZone) === today)) {
        throw new Error("ALREADY_CHECKED_IN");
      }

      const record = await tx.attendance.create({
        data: {
          gymId: actor.gymId!,
          memberId: member.id,
          recordedById: actor.id,
          method: AttendanceMethod.QR,
          idempotencyKey: `qr-${attendanceId}`,
        },
        select: { id: true, checkedInAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          gymId: actor.gymId,
          event: "attendance.qr_checked_in",
          resourceType: "attendance",
          resourceId: record.id,
          metadata: { memberId: member.id, method: AttendanceMethod.QR },
        },
      });
      return { memberName: member.name, checkedInAt: record.checkedInAt.toISOString() };
    });

    revalidatePath("/owner/attendance");
    revalidatePath("/member");
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const messages: Record<string, { status: number; message: string }> = {
      MEMBER_NOT_FOUND: { status: 404, message: "Member not found in this gym." },
      MEMBER_NOT_ACTIVE: { status: 403, message: "This member account is not active." },
      NO_ACTIVE_MEMBERSHIP: { status: 403, message: "Member does not have an active membership today." },
      ALREADY_CHECKED_IN: { status: 409, message: "This member has already checked in today." },
    };
    const issue = messages[reason] ?? { status: 409, message: "The QR code has already been used or could not be processed." };
    return NextResponse.json({ error: issue.message }, { status: issue.status });
  }
}
