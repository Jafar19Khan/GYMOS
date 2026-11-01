import Link from "next/link";
import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function SuperAdminAuditPage() {
  const user = await requireRole(Role.SUPER_ADMIN);
  const events = await prisma.auditLog.findMany({
    include: {
      actor: { select: { name: true, email: true } },
      gym: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <AppShell eyebrow="Platform operations / Security" title="Platform audit events" description="Read-only view of recent security and operational audit metadata across the platform. Member, payment and private record details are intentionally not shown." userName={user.name} roleLabel="Super Admin">
    <div className="mb-5"><Link href="/super-admin" className="text-xs font-bold text-[#b6f36a]">← Back to platform overview</Link></div>
    <section className="surface rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Recent platform events</h2><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{events.length} latest</span></div>
      {events.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No audit events recorded yet.</p> : <div className="space-y-3">
        {events.map((event) => <article key={event.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div><p className="font-bold">{event.event}</p><p className="mt-1 text-xs text-white/45">{event.actor?.name ?? "System"}{event.actor?.email ? ` · ${event.actor.email}` : ""}</p><p className="mt-1 text-[10px] text-white/35">{event.gym?.name ?? "Platform / no gym scope"}{event.gym?.slug ? ` · ${event.gym.slug}` : ""}</p></div>
            <p className="text-[10px] text-white/35">{event.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p>
          </div>
          <p className="mt-3 text-[10px] text-white/35">{event.resourceType}</p>
        </article>)}
      </div>}
      <p className="mt-5 text-[10px] leading-5 text-white/35">Showing the latest 100 events. This page deliberately omits resource identifiers and arbitrary metadata. Support access to individual gym records remains disabled.</p>
    </section>
  </AppShell>;
}
