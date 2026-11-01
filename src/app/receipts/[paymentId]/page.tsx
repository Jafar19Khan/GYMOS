import { notFound, redirect } from "next/navigation";
import { Role, PaymentType } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import PrintButton from "./print-button";

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export default async function PaymentReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      member: { select: { id: true, name: true, email: true } },
      createdBy: { select: { name: true } },
      relatedPayment: { select: { id: true, type: true, createdAt: true } },
      relatedEntries: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, amountPaise: true, note: true, createdAt: true, reference: true },
      },
      gym: { select: { id: true, name: true } },
    },
  });
  if (!payment) notFound();

  const isMemberOwner = user.role === Role.MEMBER && payment.memberId === user.id;
  const canReadOwnerLedger = user.role === Role.OWNER && user.gymId === payment.gymId
    ? await hasGymPermission(user.id, payment.gymId, "finance.read")
    : false;
  if (!isMemberOwner && !canReadOwnerLedger) notFound();

  const relatedRows = payment.type === PaymentType.CHARGE
    ? payment.relatedEntries
    : [];
  const refunded = relatedRows.filter((item) => item.type === PaymentType.REFUND).reduce((sum, item) => sum + item.amountPaise, 0);
  const adjustments = relatedRows.filter((item) => item.type === PaymentType.ADJUSTMENT).reduce((sum, item) => sum + item.amountPaise, 0);
  const netBalance = payment.amountPaise + adjustments - refunded;

  return <AppShell
    eyebrow="Finance / Receipt"
    title="Payment receipt"
    description="A printable record of a staff-entered ledger transaction. It is not a bank or gateway confirmation."
    userName={user.name}
    roleLabel={user.role === Role.MEMBER ? "Member" : "Owner / Staff"}
  >
    <article className="surface mx-auto max-w-3xl rounded-2xl p-6 md:p-9 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6 print:border-black/20">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#b6f36a] print:text-black">GYMOS</p><h2 className="mt-2 text-2xl font-black">Payment record</h2><p className="mt-1 text-sm text-white/45 print:text-black/60">{payment.gym.name}</p></div>
        <div className="text-right"><p className="text-xs uppercase tracking-wider text-white/40 print:text-black/60">Entry ID</p><p className="mt-1 break-all text-xs font-mono">{payment.id}</p><p className="mt-2 text-xs text-white/50 print:text-black/60">{payment.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p></div>
      </div>
      <div className="grid gap-5 py-6 sm:grid-cols-2">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-white/40 print:text-black/60">Member</p><p className="mt-2 font-bold">{payment.member.name}</p><p className="mt-1 text-sm text-white/55 print:text-black/70">{payment.member.email}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-white/40 print:text-black/60">Entry details</p><p className="mt-2 font-bold">{payment.type}</p><p className="mt-1 text-sm text-white/55 print:text-black/70">Method: {payment.method}</p><p className="mt-1 text-sm text-white/55 print:text-black/70">Recorded by: {payment.createdBy.name}</p></div>
      </div>
      <div className="rounded-xl border border-white/10 p-5 print:border-black/20">
        <div className="flex items-center justify-between gap-4"><span className="text-sm text-white/55 print:text-black/70">{payment.type === PaymentType.CHARGE ? "Charge amount" : payment.type === PaymentType.REFUND ? "Refund amount" : "Adjustment amount"}</span><strong className="text-2xl font-black">{payment.type === PaymentType.ADJUSTMENT && payment.amountPaise < 0 ? "−" : ""}{money(Math.abs(payment.amountPaise))}</strong></div>
        {payment.type === PaymentType.CHARGE && <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm print:border-black/20">
          <div className="flex justify-between gap-4"><span className="text-white/50 print:text-black/70">Refunded</span><span>{money(refunded)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-white/50 print:text-black/70">Adjustments (signed)</span><span>{money(adjustments)}</span></div>
          <div className="flex justify-between gap-4 border-t border-white/10 pt-3 font-bold print:border-black/20"><span>Remaining balance</span><span>{money(netBalance)}</span></div>
        </div>}
      </div>
      {payment.relatedPayment && <p className="mt-4 text-xs text-white/50 print:text-black/70">Linked to original {payment.relatedPayment.type.toLowerCase()} entry {payment.relatedPayment.id}.</p>}
      {payment.note && <div className="mt-5"><p className="text-[10px] font-bold uppercase tracking-widest text-white/40 print:text-black/60">Note / Reason</p><p className="mt-2 whitespace-pre-wrap text-sm text-white/70 print:text-black">{payment.note}</p></div>}
      {payment.reference && <p className="mt-3 text-xs text-white/50 print:text-black/70">Reference: {payment.reference}</p>}
      {payment.type === PaymentType.CHARGE && relatedRows.length > 0 && <div className="mt-6 border-t border-white/10 pt-5 print:border-black/20"><h3 className="text-sm font-bold">Linked ledger changes</h3><div className="mt-3 space-y-3">{relatedRows.map((row) => <div key={row.id} className="flex justify-between gap-4 text-xs"><span className="text-white/60 print:text-black/70">{row.type} · {row.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}{row.note ? ` · ${row.note}` : ""}</span><span>{row.type === PaymentType.ADJUSTMENT && row.amountPaise < 0 ? "−" : ""}{money(Math.abs(row.amountPaise))}</span></div>)}</div></div>}
      <p className="mt-8 border-t border-white/10 pt-5 text-[11px] leading-5 text-white/35 print:border-black/20 print:text-black/60">This document confirms that a GYMOS staff member recorded the above ledger entry. It does not independently verify receipt or settlement by a bank, card network, UPI app or payment gateway.</p>
      <div className="mt-6"><PrintButton /></div>
    </article>
  </AppShell>;
}
