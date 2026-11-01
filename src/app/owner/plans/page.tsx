import { MembershipStatus, Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { MembershipAssignForm, PlanCreateForm, PlanStatusForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export default async function PlansPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations / Memberships" title="Plans" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "memberships.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Memberships" title="Plans" description="You do not have permission to view membership data." userName={user.name} roleLabel="Gym staff" />;

  const [plans, members, memberships, canManage] = await Promise.all([
    prisma.membershipPlan.findMany({ where: { gymId: user.gymId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { gymId: user.gymId, role: Role.MEMBER, status: { not: UserStatus.SUSPENDED } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.membership.findMany({ where: { gymId: user.gymId, status: { in: [MembershipStatus.ACTIVE, MembershipStatus.UPCOMING, MembershipStatus.FROZEN] } }, include: { member: { select: { name: true, email: true } }, plan: { select: { name: true } } }, orderBy: { startDate: "desc" }, take: 100 }),
    hasGymPermission(user.id, user.gymId, "memberships.manage"),
  ]);

  return <AppShell eyebrow="Gym operations / Memberships" title="Plans & memberships" description="Create gym-specific plans and assign date-based memberships. Existing membership records are retained when a plan is deactivated." userName={user.name} roleLabel="Owner / Staff">
    {canManage && <div className="mb-6 grid gap-6 xl:grid-cols-2"><PlanCreateForm /><MembershipAssignForm plans={plans.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name, durationDays: p.durationDays }))} members={members} /></div>}
    <section className="surface rounded-2xl p-5 md:p-6">
      <h2 className="mb-5 text-lg font-extrabold">Membership plans</h2>
      {plans.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No plans created yet.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => <article key={plan.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex items-start justify-between gap-3"><h3 className="font-bold">{plan.name}</h3><span className={plan.isActive ? "text-[10px] text-emerald-300" : "text-[10px] text-white/35"}>{plan.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
          <p className="mt-3 text-2xl font-black text-[#b6f36a]">{money(plan.pricePaise)}</p>
          <p className="mt-1 text-xs text-white/45">{plan.durationDays} days</p>
          {plan.description && <p className="mt-3 text-xs leading-5 text-white/45">{plan.description}</p>}
          {canManage && <PlanStatusForm planId={plan.id} active={!plan.isActive} />}
        </article>)}
      </div>}
    </section>
    <section className="surface mt-6 rounded-2xl p-5 md:p-6">
      <h2 className="mb-5 text-lg font-extrabold">Recent memberships</h2>
      {memberships.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No memberships assigned yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40"><tr><th className="pb-3 pr-4">Member</th><th className="pb-3 pr-4">Plan</th><th className="pb-3 pr-4">Start</th><th className="pb-3 pr-4">End</th><th className="pb-3">Status</th></tr></thead>
        <tbody>{memberships.map((membership) => <tr key={membership.id} className="border-b border-white/5"><td className="py-3 pr-4"><p>{membership.member.name}</p><p className="text-xs text-white/35">{membership.member.email}</p></td><td className="py-3 pr-4">{membership.plan.name}</td><td className="py-3 pr-4">{membership.startDate.toLocaleDateString("en-IN")}</td><td className="py-3 pr-4">{membership.endDate.toLocaleDateString("en-IN")}</td><td className="py-3">{membership.status}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </AppShell>;
}
