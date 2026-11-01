import { MembershipStatus, Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { AttendanceCreateForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { dateOnlyInTimeZone } from "@/lib/operations/dates";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AttendancePage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations" title="Attendance" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "attendance.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Attendance" title="Attendance" description="You do not have permission to view attendance records." userName={user.name} roleLabel="Gym staff" />;

  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";
  const today = dateOnlyInTimeZone(new Date(), timeZone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [records, members, canManage] = await Promise.all([
    prisma.attendance.findMany({
      where: { gymId: user.gymId },
      include: { member: { select: { name: true, email: true } }, recordedBy: { select: { name: true } } },
      orderBy: { checkedInAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: {
        gymId: user.gymId,
        role: Role.MEMBER,
        status: UserStatus.ACTIVE,
        memberships: {
          some: {
            gymId: user.gymId,
            status: MembershipStatus.ACTIVE,
            startDate: { lte: todayDate },
            endDate: { gte: todayDate },
          },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    hasGymPermission(user.id, user.gymId, "attendance.manage"),
  ]);

  return <AppShell eyebrow="Gym operations / Daily check-ins" title="Attendance" description="Record manual member check-ins and review the latest gym attendance. Each active member can be checked in once per gym-local calendar day." userName={user.name} roleLabel="Owner / Staff">
    {canManage && <div className="mb-6 grid gap-4 xl:grid-cols-2"><AttendanceCreateForm members={members} /><section className="surface rounded-2xl p-5 md:p-6"><p className="eyebrow">Contactless check-in</p><h2 className="mt-2 text-lg font-extrabold">Scan member QR</h2><p className="mt-2 text-xs leading-5 text-white/45">Use the camera scanner for signed, short-lived member QR codes.</p><Link href="/owner/attendance/scan" className="mt-5 inline-flex rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a]">Open QR scanner</Link></section></div>}
    <section className="surface rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Recent check-ins</h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{records.length} shown</span>
      </div>
      {records.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No attendance recorded yet.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40"><tr><th className="pb-3 pr-4">Checked in</th><th className="pb-3 pr-4">Member</th><th className="pb-3 pr-4">Method</th><th className="pb-3 pr-4">Recorded by</th><th className="pb-3">Note</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.id} className="border-b border-white/5">
            <td className="py-3 pr-4 whitespace-nowrap">{record.checkedInAt.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })}</td>
            <td className="py-3 pr-4"><p>{record.member.name}</p><p className="text-xs text-white/35">{record.member.email}</p></td>
            <td className="py-3 pr-4">{record.method}</td><td className="py-3 pr-4">{record.recordedBy?.name ?? "System"}</td><td className="py-3 text-white/55">{record.note ?? "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-5 text-[11px] text-white/35">Showing the latest 100 check-ins. Manual and signed QR check-ins are recorded in the same attendance ledger.</p>
    </section>
  </AppShell>;
}
