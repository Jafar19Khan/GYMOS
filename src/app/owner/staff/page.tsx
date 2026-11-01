import { Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { StaffCreateForm, StaffPermissionsForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function StaffPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations / Team" title="Staff" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "staff.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Team" title="Staff" description="You do not have permission to view staff records." userName={user.name} roleLabel="Gym staff" />;

  const [staff, canManage] = await Promise.all([
    prisma.user.findMany({
      where: { gymId: user.gymId, role: Role.OWNER, isGymOwner: false },
      include: { permissions: { where: { gymId: user.gymId }, orderBy: { permission: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    hasGymPermission(user.id, user.gymId, "staff.manage"),
  ]);

  return <AppShell eyebrow="Gym operations / Team" title="Staff access" description="Trainer, receptionist, accountant and manager access is configured as explicit permissions under the Owner workspace." userName={user.name} roleLabel="Owner / Staff">
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)]">
      {canManage && <StaffCreateForm />}
      <section className="surface rounded-2xl p-5 md:p-6">
        <h2 className="mb-5 text-lg font-extrabold">Team accounts</h2>
        {staff.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No staff accounts have been added.</p> : <div className="space-y-4">
          {staff.map((person) => <article key={person.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-bold">{person.name}</p><p className="mt-1 text-xs text-white/45">{person.email}</p></div>
              <span className={person.status === UserStatus.ACTIVE ? "rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] text-emerald-300" : "rounded-full bg-amber-400/10 px-3 py-1 text-[10px] text-amber-200"}>{person.status}</span>
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/35">Granted permissions</p>
            <div className="mt-2 flex flex-wrap gap-2">{person.permissions.length ? person.permissions.map((p) => <span key={p.id} className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-white/60">{p.permission}</span>) : <span className="text-xs text-white/35">No permissions assigned</span>}</div>
            {canManage && <details className="mt-4 border-t border-white/10 pt-3">
              <summary className="cursor-pointer text-xs font-bold text-[#b6f36a]">Edit permissions</summary>
              <StaffPermissionsForm staffId={person.id} selected={person.permissions.map((p) => p.permission)} />
            </details>}
          </article>)}
        </div>}
        <p className="mt-5 text-[11px] leading-5 text-white/35">Invited staff accounts cannot sign in until activation is implemented. Staff permissions do not grant Super Admin or gym-owner privileges.</p>
      </section>
    </div>
  </AppShell>;
}
