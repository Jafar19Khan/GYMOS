import { PaymentType, Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { PaymentCreateForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export default async function PaymentsPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations / Finance" title="Payments" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "finance.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Finance" title="Payments" description="You do not have permission to view finance records." userName={user.name} roleLabel="Gym staff" />;

  const [payments, members, canWrite] = await Promise.all([
    prisma.payment.findMany({
      where: { gymId: user.gymId },
      include: { member: { select: { name: true, email: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({ where: { gymId: user.gymId, role: Role.MEMBER }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 500 }),
    hasGymPermission(user.id, user.gymId, "finance.write"),
  ]);

  const charges = payments.filter((payment) => payment.type === PaymentType.CHARGE).reduce((sum, payment) => sum + payment.amountPaise, 0);
  const refunds = payments.filter((payment) => payment.type === PaymentType.REFUND).reduce((sum, payment) => sum + payment.amountPaise, 0);

  return <AppShell eyebrow="Gym operations / Finance" title="Payment ledger" description="Staff-entered payment records only. This module does not charge cards, process UPI or connect to a payment gateway." userName={user.name} roleLabel="Owner / Staff">
    <div className="mb-6 grid gap-4 sm:grid-cols-2">
      <article className="surface rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-white/40">Charges recorded · latest 100</p><p className="mt-3 text-3xl font-black text-[#b6f36a]">{money(charges)}</p></article>
      <article className="surface rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-white/40">Refund entries · latest 100</p><p className="mt-3 text-3xl font-black">{money(refunds)}</p></article>
    </div>
    {canWrite && <div className="mb-6"><PaymentCreateForm members={members} /></div>}
    <section className="surface rounded-2xl p-5 md:p-6">
      <h2 className="mb-5 text-lg font-extrabold">Recent payment entries</h2>
      {payments.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No payment entries recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 text-[10px] uppercase tracking-widest text-white/40"><tr><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Member</th><th className="pb-3 pr-4">Method</th><th className="pb-3 pr-4">Type</th><th className="pb-3 pr-4">Amount</th><th className="pb-3">Recorded by</th></tr></thead>
        <tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-white/5"><td className="py-3 pr-4">{payment.createdAt.toLocaleDateString("en-IN")}</td><td className="py-3 pr-4"><p>{payment.member.name}</p><p className="text-xs text-white/35">{payment.member.email}</p></td><td className="py-3 pr-4">{payment.method}</td><td className="py-3 pr-4">{payment.type}</td><td className="py-3 pr-4 font-bold">{money(payment.amountPaise)}</td><td className="py-3">{payment.createdBy.name}</td></tr>)}</tbody>
      </table></div>}
      <p className="mt-5 text-[11px] leading-5 text-white/35">This list is limited to the latest 100 entries. Refund and adjustment workflows, receipts and date-range reconciliation are not yet enabled. Summary totals shown above cover only the displayed entries.</p>
    </section>
  </AppShell>;
}
