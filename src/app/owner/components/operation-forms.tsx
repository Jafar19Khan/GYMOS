"use client";

import { useActionState } from "react";
import {
  assignMembershipAction,
  createMemberAction,
  createMembershipPlanAction,
  createStaffAction,
  recordPaymentAction,
  setMembershipPlanActiveAction,
  updateMemberStatusAction,
  updateStaffPermissionsAction,
} from "@/app/actions/gym-operations";
import type { ActionState } from "@/app/actions/gym-operations";

const initial: ActionState = { ok: false, message: "" };

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p role="status" className={state.ok
    ? "mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-200"
    : "mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100"}>{state.message}</p>;
}

function Field({ label, name, type = "text", required = false, placeholder, min, step }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; min?: string; step?: string;
}) {
  return <label className="block">
    <span className="mb-2 block text-xs font-semibold text-white/65">{label}</span>
    <input name={name} type={type} required={required} placeholder={placeholder} min={min} step={step}
      className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b6f36a]/60" />
  </label>;
}

function Submit({ label }: { label: string }) {
  return <button type="submit" className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] transition hover:bg-white">{label}</button>;
}

export function MemberCreateForm() {
  const [state, action, pending] = useActionState(createMemberAction, initial);
  return <section className="surface h-fit rounded-2xl p-5 md:p-6">
    <p className="eyebrow">New record</p>
    <h2 className="mt-2 text-lg font-extrabold">Add member</h2>
    <p className="mb-5 mt-2 text-xs leading-5 text-white/40">Creates an invitation-pending member record. It does not send an email or activate login access.</p>
    <form action={action} className="space-y-4">
      <Field label="Full name" name="name" required placeholder="Member name" />
      <Field label="Email address" name="email" type="email" required placeholder="member@example.com" />
      <Field label="Phone (optional)" name="phone" placeholder="+91..." />
      <button disabled={pending} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-60">{pending ? "Creating…" : "Create member record"}</button>
    </form>
    <Notice state={state} />
  </section>;
}

export function MemberStatusForm({ memberId, nextStatus }: { memberId: string; nextStatus: "ACTIVE" | "SUSPENDED" }) {
  const [state, action, pending] = useActionState(updateMemberStatusAction, initial);
  return <form action={action} className="flex items-center gap-2">
    <input type="hidden" name="memberId" value={memberId} />
    <input type="hidden" name="status" value={nextStatus} />
    <button disabled={pending} className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold text-white/65 transition hover:border-[#b6f36a]/50 hover:text-[#b6f36a] disabled:opacity-50">{pending ? "Saving…" : nextStatus === "SUSPENDED" ? "Suspend" : "Reactivate"}</button>
    <span className="sr-only" aria-live="polite">{state.message}</span>
  </form>;
}

const permissions = [
  ["dashboard.read", "View dashboard"],
  ["members.read", "View members"],
  ["members.write", "Add and edit members"],
  ["members.suspend", "Suspend members"],
  ["staff.read", "View staff"],
  ["memberships.read", "View plans and memberships"],
  ["memberships.manage", "Manage plans and memberships"],
  ["attendance.read", "View attendance"],
  ["attendance.manage", "Manage attendance"],
  ["classes.read", "View classes"],
  ["classes.manage", "Manage classes"],
  ["finance.read", "View finance records"],
  ["finance.write", "Record payments"],
  ["finance.refund", "Manage refunds"],
  ["reports.read", "View reports"],
  ["cms.manage", "Manage website content"],
  ["media.manage", "Manage media"],
  ["settings.manage", "Manage gym settings"],
] as const;

export function StaffCreateForm() {
  const [state, action, pending] = useActionState(createStaffAction, initial);
  return <section className="surface h-fit rounded-2xl p-5 md:p-6">
    <p className="eyebrow">New team account</p>
    <h2 className="mt-2 text-lg font-extrabold">Add staff</h2>
    <p className="mb-5 mt-2 text-xs leading-5 text-white/40">Staff accounts are invitation-pending. Choose only the permissions needed for this person's work.</p>
    <form action={action} className="space-y-4">
      <Field label="Full name" name="name" required placeholder="Staff name" />
      <Field label="Email address" name="email" type="email" required placeholder="staff@example.com" />
      <fieldset className="rounded-xl border border-white/10 p-3">
        <legend className="px-1 text-xs font-semibold text-white/65">Permissions</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {permissions.map(([value, label]) => <label key={value} className="flex items-start gap-2 text-xs text-white/60">
            <input type="checkbox" name="permissions" value={value} className="mt-0.5 accent-[#b6f36a]" />
            <span>{label}</span>
          </label>)}
        </div>
      </fieldset>
      <button disabled={pending} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-60">{pending ? "Creating…" : "Create staff account"}</button>
    </form>
    <Notice state={state} />
  </section>;
}

export function StaffPermissionsForm({ staffId, selected }: { staffId: string; selected: string[] }) {
  const [state, action, pending] = useActionState(updateStaffPermissionsAction, initial);
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="staffId" value={staffId} />
    <div className="grid gap-2 sm:grid-cols-2">
      {permissions.map(([value, label]) => <label key={value} className="flex items-start gap-2 text-xs text-white/55">
        <input type="checkbox" name="permissions" value={value} defaultChecked={selected.includes(value)} className="mt-0.5 accent-[#b6f36a]" />
        <span>{label}</span>
      </label>)}
    </div>
    <button disabled={pending} className="rounded-full border border-[#b6f36a]/40 px-4 py-2 text-xs font-bold text-[#b6f36a] disabled:opacity-50">{pending ? "Saving…" : "Save permissions"}</button>
    <Notice state={state} />
  </form>;
}

export function PlanCreateForm() {
  const [state, action, pending] = useActionState(createMembershipPlanAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Plan setup</p>
    <h2 className="mt-2 text-lg font-extrabold">Create membership plan</h2>
    <form action={action} className="mt-5 space-y-4">
      <Field label="Plan name" name="name" required placeholder="Monthly access" />
      <Field label="Duration (days)" name="durationDays" type="number" required min="1" placeholder="30" />
      <Field label="Price (INR)" name="price" required placeholder="1499.00" />
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Description (optional)</span><textarea name="description" maxLength={500} rows={3} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white outline-none focus:border-[#b6f36a]/60" /></label>
      <button disabled={pending} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-60">{pending ? "Creating…" : "Create plan"}</button>
    </form>
    <Notice state={state} />
  </section>;
}

export function PlanStatusForm({ planId, active }: { planId: string; active: boolean }) {
  const [state, action, pending] = useActionState(setMembershipPlanActiveAction, initial);
  return <form action={action} className="mt-4">
    <input type="hidden" name="planId" value={planId} />
    <input type="hidden" name="active" value={String(active)} />
    <button disabled={pending} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-bold text-white/60 hover:border-[#b6f36a]/50 hover:text-[#b6f36a] disabled:opacity-50">{pending ? "Saving…" : active ? "Activate plan" : "Deactivate plan"}</button>
    <span className="sr-only" aria-live="polite">{state.message}</span>
  </form>;
}

type MemberOption = { id: string; name: string; email: string };
type PlanOption = { id: string; name: string; durationDays: number };

export function MembershipAssignForm({ members, plans }: { members: MemberOption[]; plans: PlanOption[] }) {
  const [state, action, pending] = useActionState(assignMembershipAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Member access</p>
    <h2 className="mt-2 text-lg font-extrabold">Assign membership</h2>
    <form action={action} className="mt-5 space-y-4">
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Member</span><select name="memberId" required defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white"><option value="" disabled>Select a member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Plan</span><select name="planId" required defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white"><option value="" disabled>Select a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.durationDays} days</option>)}</select></label>
      <Field label="Start date" name="startDate" type="date" required />
      <button disabled={pending || !members.length || !plans.length} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Assigning…" : "Assign membership"}</button>
    </form>
    <Notice state={state} />
    {(!members.length || !plans.length) && <p className="mt-3 text-[11px] text-white/35">Add at least one member and one active plan first.</p>}
  </section>;
}

export function PaymentCreateForm({ members }: { members: MemberOption[] }) {
  const [state, action, pending] = useActionState(recordPaymentAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Manual payment entry</p>
    <h2 className="mt-2 text-lg font-extrabold">Record payment</h2>
    <p className="mt-2 text-xs leading-5 text-white/40">This records a payment already received by the gym. It does not initiate a payment or charge a bank/card.</p>
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Member</span><select name="memberId" required defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white"><option value="" disabled>Select a member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>
      <Field label="Amount (INR)" name="amount" required placeholder="1499.00" />
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Payment method</span><select name="method" required defaultValue="UPI" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card (record only)</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></select></label>
      <Field label="Reference (optional)" name="reference" placeholder="Receipt / transaction reference" />
      <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold text-white/65">Note (optional)</span><textarea name="note" maxLength={500} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white outline-none focus:border-[#b6f36a]/60" /></label>
      <div className="md:col-span-2"><button disabled={pending || !members.length} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Recording…" : "Record payment"}</button></div>
    </form>
    <Notice state={state} />
    {!members.length && <p className="mt-3 text-[11px] text-white/35">Add a member record before entering a payment.</p>}
  </section>;
}
