import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function OwnerAuditPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations / Security" title="Audit history" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;
  if (!(await hasGymPermission(user.id, user.gymId, "audit.read"))) {
    return <AppShell eyebrow="Gym operations / Security" title="Access restricted" description="You do not have permission to review audit events." userName={user.name} roleLabel="Gym staff" />;
  }

  const events = await prisma.auditLog.findMany({
    where: { gymId: user.gymId },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";

  return <AppShell eyebrow="Gym operations / Security" title="Audit history" description="Recent gym-scoped account, membership, finance and operational events. Sensitive token and password values are not stored in audit metadata." userName={user.name} roleLabel="Owner / Staff">
    <section className="surface rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Recent events</h2><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{events.length} latest</span></div>
      {events.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No audit events recorded yet.</p> : <div className="space-y-3">
        {events.map((event) => <article key={event.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div><p className="font-bold">{event.event}</p><p className="mt-1 text-xs text-white/45">{event.actor?.name ?? "System"}{event.actor?.email ? ` · ${event.actor.email}` : ""}</p></div>
            <p className="text-[10px] text-white/35">{event.createdAt.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <p className="mt-3 text-[10px] text-white/35">{event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ""}</p>
          {event.metadata && <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] leading-5 text-white/45">{JSON.stringify(event.metadata)}</pre>}
        </article>)}
      </div>}
      <p className="mt-5 text-[10px] text-white/35">Showing the latest 100 records. Automated retention/deletion is intentionally not enabled; export/retention policy must be defined before production launch.</p>
    </section>
  </AppShell>;
}
