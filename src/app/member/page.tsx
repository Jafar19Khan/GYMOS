import { MembershipStatus, Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { dateOnlyInTimeZone } from "@/lib/operations/dates";
import AttendanceQrCard from "@/app/member/components/attendance-qr-card";

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="surface rounded-2xl p-6">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/45">{label}</p>
    <p className="mt-4 text-2xl font-black tracking-tight text-[#b6f36a]">{value}</p>
    <p className="mt-2 text-xs text-white/40">{detail}</p>
  </article>;
}

export default async function MemberDashboard() {
  const user = await requireRole(Role.MEMBER);
  const today = dateOnlyInTimeZone(new Date(), user.gym?.timezone ?? "Asia/Kolkata");
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [profile, memberships, attendanceCount, attendanceHistory, bookingCount] = await Promise.all([
    prisma.memberProfile.findUnique({ where: { userId: user.id } }),
    prisma.membership.findMany({
      where: {
        memberId: user.id,
        ...(user.gymId ? { gymId: user.gymId } : {}),
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.UPCOMING, MembershipStatus.FROZEN] },
        endDate: { gte: todayDate },
      },
      include: { plan: true },
      orderBy: { startDate: "desc" },
      take: 3,
    }),
    prisma.attendance.count({ where: { memberId: user.id, ...(user.gymId ? { gymId: user.gymId } : {}) } }),
    prisma.attendance.findMany({ where: { memberId: user.id, ...(user.gymId ? { gymId: user.gymId } : {}) }, orderBy: { checkedInAt: "desc" }, take: 10, select: { id: true, checkedInAt: true, method: true } }),
    prisma.classBooking.count({ where: { memberId: user.id, status: { in: ["BOOKED", "WAITLISTED"] } } }),
  ]);

  const currentMembership = memberships.find((item) => item.status === MembershipStatus.ACTIVE);
  const planName = currentMembership?.plan.name ?? "No active plan";

  return <AppShell eyebrow="Your fitness space" title={`Welcome, ${user.name.split(" ")[0]}`}
    description="Your personal workspace. Only your own membership, attendance and bookings are shown here."
    userName={user.name} roleLabel="Member">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Membership" value={planName} detail={currentMembership ? `Valid until ${currentMembership.endDate.toLocaleDateString("en-IN", { timeZone: "UTC" })}` : "Ask your gym about membership plans"} />
      <Metric label="Check-ins" value={attendanceCount} detail="Your recorded visits" />
      <Metric label="Class bookings" value={bookingCount} detail="Your booked and waitlisted classes" />
    </div>
    {user.gymId && <div className="mt-6"><AttendanceQrCard /></div>}
    <section className="surface mt-6 rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Recent attendance</h2>
      {attendanceHistory.length === 0 ? <p className="mt-4 py-5 text-center text-sm text-white/40">No check-ins recorded yet.</p> : <div className="mt-4 divide-y divide-white/5">
        {attendanceHistory.map((record) => <div key={record.id} className="flex items-center justify-between gap-4 py-3 text-sm">
          <span>{record.checkedInAt.toLocaleString("en-IN", { timeZone: user.gym?.timezone ?? "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{record.method}</span>
        </div>)}
      </div>}
      <p className="mt-3 text-[11px] text-white/35">Showing your latest 10 check-ins.</p>
    </section>
    <section className="surface mt-6 rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Your profile</h2>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div><p className="text-xs text-white/40">Email</p><p className="mt-1">{user.email}</p></div>
        <div><p className="text-xs text-white/40">Contact number</p><p className="mt-1">{profile?.phone ?? "Not added"}</p></div>
        <div><p className="text-xs text-white/40">Gym</p><p className="mt-1">{user.gym?.name ?? "Not linked"}</p></div>
        <div><p className="text-xs text-white/40">Membership plans on record</p><p className="mt-1">{memberships.length}</p></div>
      </div>
      <p className="mt-5 text-xs text-white/40">You can review your payment history and open printable receipts from Payments. Profile changes are handled by authorized gym staff.</p>
    </section>
  </AppShell>;
}
