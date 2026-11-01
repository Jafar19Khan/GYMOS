import Link from "next/link";
import { PaymentType, Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { AdjustmentCreateForm, PaymentCreateForm, RefundCreateForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { addCalendarDays, localDateTimeToUtc, dateOnlyInTimeZone } from "@/lib/operations/dates";
import { prisma } from "@/lib/prisma";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function PaymentsPage({ searchParams }: PageProps) {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations / Finance" title="Payments" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "finance.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Finance" title="Payments" description="You do not have permission to view finance records." userName={user.name} roleLabel="Gym staff" />;

  const params = await searchParams;
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";
  const today = dateOnlyInTimeZone(new Date(), timeZone);
  const defaultFrom = addCalendarDays(today, -29);
  const from = validDate(params.from) ? params.from : defaultFrom;
  const to = validDate(params.to) ? params.to : today;
  const rangeValid = to >= from;
  const rangeStart = rangeValid ? localDateTimeToUtc(`${from}T00:00`, timeZone) : null;
  const rangeEnd = rangeValid ? localDateTimeToUtc(`${addCalendarDays(to, 1)}T00:00`, timeZone) : null;
  const dateFilter = rangeStart && rangeEnd ? { gte: rangeStart, lt: rangeEnd } : undefined;
  const where = { gymId: user.gymId, ...(dateFilter ? { createdAt: dateFilter } : {}) };

  const [payments, members, canWrite, canCorrect, totals] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        member: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
        relatedPayment: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { gymId: user.gymId, role: Role.MEMBER },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    hasGymPermission(user.id, user.gymId, "finance.write"),
    hasGymPermission(user.id, user.gymId, "finance.refund"),
    prisma.payment.groupBy({
      by: ["type"],
      where,
      _sum: { amountPaise: true },
      _count: { _all: true },
    }),
  ]);

  const amountFor = (type: PaymentType) => totals.find((row) => row.type === type)?._sum.amountPaise ?? 0;
  const charges = amountFor(PaymentType.CHARGE);
  const refunds = amountFor(PaymentType.REFUND);
  const adjustments = amountFor(PaymentType.ADJUSTMENT);
  const net = charges - refunds + adjustments;
  const rangeLabel = rangeValid ? `${from} to ${to}` : "Invalid date range";

  return <AppShell eyebrow="Gym operations / Finance" title="Payment ledger" description="Charges, linked refunds and signed adjustments. Reconciliation totals cover every matching ledger entry, not only the recent rows displayed below." userName={user.name} roleLabel="Owner / Staff">
    <section className="surface mb-6 rounded-2xl p-5 md:p-6">
      <h2 className="text-sm font-extrabold">Date-range reconciliation</h2>
      <form method="get" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block"><span className="mb-2 block text-[11px] font-semibold text-white/60">From</span><input name="from" type="date" required defaultValue={from} className="rounded-xl border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white" /></label>
        <label className="block"><span className="mb-2 block text-[11px] font-semibold text-white/60">To</span><input name="to" type="date" required defaultValue={to} className="rounded-xl border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white" /></label>
        <button className="rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a]">Reconcile</button>
        <Link href="/owner/payments" className="rounded-full border border-white/15 px-5 py-3 text-center text-xs font-bold text-white/60">Last 30 days</Link>
      </form>
      {!rangeValid && <p role="alert" className="mt-3 text-xs text-amber-200">The end date must be on or after the start date. Choose a valid range.</p>}
      <p className="mt-3 text-[10px] text-white/35">Range: {rangeLabel} · gym timezone: {timeZone} · summaries include all matching ledger entries.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-white/10 p-4"><p className="text-[10px] uppercase tracking-wider text-white/40">Charges</p><p className="mt-2 text-xl font-black text-[#b6f36a]">{money(charges)}</p></article>
        <article className="rounded-xl border border-white/10 p-4"><p className="text-[10px] uppercase tracking-wider text-white/40">Refunds</p><p className="mt-2 text-xl font-black">{money(refunds)}</p></article>
        <article className="rounded-xl border border-white/10 p-4"><p className="text-[10px] uppercase tracking-wider text-white/40">Adjustments (signed)</p><p className="mt-2 text-xl font-black">{money(adjustments)}</p></article>
        <article className="rounded-xl border border-[#b6f36a]/30 p-4"><p className="text-[10px] uppercase tracking-wider text-white/40">Net ledger total</p><p className="mt-2 text-xl font-black text-[#b6f36a]">{money(net)}</p></article>
      </div>
    </section>

    {canWrite && <div className="mb-6"><PaymentCreateForm members={members} /></div>}
    <section className="surface rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Ledger entries</h2><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{payments.length} latest shown</span></div>
      {payments.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No entries found for this date range.</p> : <div className="space-y-3">
        {payments.map((payment) => <article key={payment.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold text-white/65">{payment.type}</span><p className="font-bold">{payment.member.name}</p></div>
              <p className="mt-1 text-xs text-white/40">{payment.member.email} · {payment.createdAt.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="mt-1 text-[11px] text-white/40">{payment.method} · Recorded by {payment.createdBy.name}{payment.relatedPayment ? " · linked correction" : ""}</p>
              {payment.note && <p className="mt-2 text-xs text-white/55">{payment.note}</p>}
            </div>
            <div className="text-left lg:text-right"><p className="text-xl font-black">{payment.type === PaymentType.ADJUSTMENT && payment.amountPaise < 0 ? "−" : ""}{money(Math.abs(payment.amountPaise))}</p><Link href={`/receipts/${payment.id}`} className="mt-2 inline-block text-[10px] font-bold text-[#b6f36a]">Open receipt</Link></div>
          </div>
          {payment.type === PaymentType.CHARGE && canCorrect && <div className="mt-3 grid gap-4 border-t border-white/10 pt-3 sm:grid-cols-2"><RefundCreateForm paymentId={payment.id} /><AdjustmentCreateForm paymentId={payment.id} /></div>}
        </article>)}
      </div>}
      <p className="mt-5 text-[11px] leading-5 text-white/35">Showing the latest 100 matching entries. Reconciliation totals above cover all entries in the selected range. Refunds cannot exceed the linked charge balance; adjustments are signed, reason-required ledger events.</p>
    </section>
  </AppShell>;
}
