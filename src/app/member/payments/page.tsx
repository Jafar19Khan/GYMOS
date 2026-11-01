import Link from "next/link";
import { PaymentType, Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Math.abs(paise) / 100);
}

export default async function MemberPaymentsPage() {
  const user = await requireRole(Role.MEMBER);
  const payments = await prisma.payment.findMany({
    where: { memberId: user.id, ...(user.gymId ? { gymId: user.gymId } : {}) },
    include: { relatedPayment: { select: { id: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";

  return <AppShell eyebrow="Member space / Finance" title="My payments" description="View the payment and refund records that belong to your account and open printable receipts." userName={user.name} roleLabel="Member">
    <section className="surface rounded-2xl p-5 md:p-6">
      <h2 className="mb-5 text-lg font-extrabold">Payment history</h2>
      {payments.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No payment records are available yet.</p> : <div className="space-y-3">
        {payments.map((payment) => <article key={payment.id} className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2"><span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold text-white/65">{payment.type}</span><span className="text-xs text-white/45">{payment.createdAt.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })}</span></div>
            <p className="mt-2 text-xs text-white/45">{payment.method}{payment.relatedPayment ? ` · linked to ${payment.relatedPayment.type.toLowerCase()}` : ""}</p>
            {payment.note && <p className="mt-1 text-xs text-white/55">{payment.note}</p>}
          </div>
          <div className="sm:text-right"><p className="text-lg font-black">{payment.type === PaymentType.ADJUSTMENT && payment.amountPaise < 0 ? "−" : ""}{money(payment.amountPaise)}</p><Link href={`/receipts/${payment.id}`} className="mt-1 inline-block text-[10px] font-bold text-[#b6f36a]">View receipt</Link></div>
        </article>)}
      </div>}
      <p className="mt-5 text-[11px] text-white/35">Showing the latest 100 records. Contact the gym for a full historical statement.</p>
    </section>
  </AppShell>;
}
