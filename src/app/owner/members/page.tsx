import { Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { MemberCreateForm, MemberStatusForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function MembersPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations" title="Members" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "members.read");
  if (!canRead) return <AppShell eyebrow="Gym operations" title="Members" description="You do not have permission to view member records." userName={user.name} roleLabel="Gym staff" />;

  const [members, canCreate, canSuspend] = await Promise.all([
    prisma.user.findMany({
      where: { gymId: user.gymId, role: Role.MEMBER },
      include: { memberProfile: true, memberships: { orderBy: { endDate: "desc" }, take: 1, include: { plan: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    hasGymPermission(user.id, user.gymId, "members.write"),
    hasGymPermission(user.id, user.gymId, "members.suspend"),
  ]);

  return <AppShell eyebrow="Gym operations / People" title="Members" description="Manage member profiles and account status. New records are invitation-pending until the secure activation flow is available." userName={user.name} roleLabel="Owner / Staff">
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,.75fr)_minmax(0,1.5fr)]">
      {canCreate && <MemberCreateForm />}
      <section className="surface rounded-2xl p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Member directory</h2>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{members.length} shown</span>
        </div>
        {members.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No member records yet.</p> : <div className="space-y-3">
          {members.map((member) => {
            const membership = member.memberships[0];
            return <article key={member.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="truncate font-bold">{member.name}</p>
                  <p className="mt-1 truncate text-xs text-white/45">{member.email}</p>
                  <p className="mt-2 text-xs text-white/50">{member.memberProfile?.phone ?? "No phone"} · {membership?.plan.name ?? "No membership"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={member.status === UserStatus.ACTIVE ? "rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-300" : "rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-200"}>{member.status}</span>
                  {canSuspend && member.status !== UserStatus.INVITED && <MemberStatusForm memberId={member.id} nextStatus={member.status === UserStatus.SUSPENDED ? "ACTIVE" : "SUSPENDED"} />}
                </div>
              </div>
            </article>;
          })}
        </div>}
        <p className="mt-5 text-[11px] leading-5 text-white/35">Showing latest 100 records. Search, pagination, invitations and secure password activation are follow-up tasks.</p>
      </section>
    </div>
  </AppShell>;
}
