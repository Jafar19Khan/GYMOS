import Link from "next/link";
import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article className="surface rounded-2xl p-6">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/45">{label}</p>
    <p className="mt-4 text-4xl font-black tracking-tight text-[#b6f36a]">{value.toLocaleString("en-IN")}</p>
    <p className="mt-2 text-xs text-white/40">{detail}</p>
  </article>;
}

export default async function SuperAdminDashboard() {
  const user = await requireRole(Role.SUPER_ADMIN);
  const [gyms, accounts, recentAuditEvents] = await Promise.all([
    prisma.gym.count(),
    prisma.user.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  return <AppShell eyebrow="Platform operations" title="Super Admin"
    description="A platform-level overview. Gym member and financial records are not exposed in this workspace."
    userName={user.name} roleLabel="Super Admin">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Registered gyms" value={gyms} detail="Gyms in the platform database" />
      <Metric label="User accounts" value={accounts} detail="All platform accounts" />
      <Metric label="Audit events" value={recentAuditEvents} detail="Recorded in the last 24 hours" />
    </div>
    <section className="surface mt-6 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Operations and security</h2><Link href="/super-admin/audit" className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold text-[#b6f36a]">Review platform audit</Link></div>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
        This dashboard exposes aggregate platform counts and a read-only platform audit view.
        Direct gym/member record access, support impersonation, backup operations and platform settings remain disabled.
      </p>
      <p className="mt-4 text-xs text-[#b6f36a]">Sensitive gym-level access remains disabled in this milestone.</p>
    </section>
  </AppShell>;
}
