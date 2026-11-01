import { Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { dateOnlyInTimeZone } from "@/lib/operations/dates";

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article className="surface rounded-2xl p-6">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/45">{label}</p>
    <p className="mt-4 text-4xl font-black tracking-tight text-[#b6f36a]">{value.toLocaleString("en-IN")}</p>
    <p className="mt-2 text-xs text-white/40">{detail}</p>
  </article>;
}

export default async function OwnerDashboard() {
  const user = await requireRole(Role.OWNER);

  if (!user.gymId) {
    return <AppShell eyebrow="Gym operations" title="Owner workspace" description="Your account is not linked to a gym yet." userName={user.name} roleLabel="Owner">
      <section className="surface rounded-2xl p-6">
        <h2 className="text-lg font-bold">Gym setup required</h2>
        <p className="mt-2 text-sm leading-7 text-white/50">Ask the platform administrator to finish linking this owner account to a gym.</p>
      </section>
    </AppShell>;
  }

  const canReadDashboard = await hasGymPermission(user.id, user.gymId, "dashboard.read");
  if (!canReadDashboard) {
    return <AppShell eyebrow="Gym operations" title="Access restricted" description="Your staff account does not currently have permission to view this dashboard." userName={user.name} roleLabel="Gym staff">
      <section className="surface rounded-2xl p-6"><h2 className="text-lg font-bold">Permission required</h2><p className="mt-2 text-sm leading-7 text-white/50">Ask the gym owner to grant the dashboard.read permission. No gym records were returned.</p></section>
    </AppShell>;
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const today = dateOnlyInTimeZone(new Date(), user.gym?.timezone ?? "Asia/Kolkata");
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [members, activeMembers, activeMemberships, recentAttendance, paymentRecords] = await Promise.all([
    prisma.user.count({ where: { gymId: user.gymId, role: Role.MEMBER } }),
    prisma.user.count({ where: { gymId: user.gymId, role: Role.MEMBER, status: UserStatus.ACTIVE } }),
    prisma.membership.count({ where: { gymId: user.gymId, status: "ACTIVE", endDate: { gte: todayDate } } }),
    prisma.attendance.count({ where: { gymId: user.gymId, checkedInAt: { gte: since } } }),
    prisma.payment.count({ where: { gymId: user.gymId } }),
  ]);

  return <AppShell eyebrow="Gym operations" title="Owner dashboard"
    description="Your gym at a glance. These figures are read from your gym-scoped database records, not sample dashboard data."
    userName={user.name} roleLabel="Owner">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Total members" value={members} detail="Member accounts registered in your gym" />
      <Metric label="Active members" value={activeMembers} detail="Accounts currently enabled" />
      <Metric label="Active memberships" value={activeMemberships} detail="Memberships not yet expired" />
      <Metric label="Attendance records" value={recentAttendance} detail="Last 30 days" />
      <Metric label="Payment records" value={paymentRecords} detail="Staff-entered ledger records" />
    </div>
    <section className="surface mt-6 rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Operational status</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
        Your workspace supports member and staff administration, memberships, manual attendance,
        capacity-safe class booking, and a reconciled staff-entered payment ledger with printable receipts.
      </p>
      <p className="mt-4 text-xs text-[#b6f36a]">Payments are recorded manually. No bank, UPI or card gateway is connected.</p>
    </section>
  </AppShell>;
}
