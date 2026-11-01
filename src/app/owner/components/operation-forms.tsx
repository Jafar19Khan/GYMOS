"use client";

import { useActionState } from "react";
import {
  archiveMemberAction,
  assignMembershipAction,
  bookGymClassAction,
  cancelGymClassBookingAction,
  createAnnouncementAction,
  createDietPlanAction,
  createGymClassAction,
  createWorkoutPlanAction,
  createMemberAction,
  createMembershipPlanAction,
  createStaffAction,
  issueAccountInvitationAction,
  recordAttendanceAction,
  recordPaymentAction,
  recordRefundAction,
  recordAdjustmentAction,
  setMembershipPlanActiveAction,
  updateMemberProfileAction,
  updateMemberStatusAction,
  updateStaffPermissionsAction,
  updateStaffStatusAction,
  updateGymWebsiteAction,
  logWorkoutSessionAction,
  recordFitnessProgressAction,
} from "@/app/actions/gym-operations";
import type { ActionState } from "@/app/actions/gym-operations";

const initial: ActionState = { ok: false, message: "" };

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <div className="mt-4 space-y-3">
    <p role="status" className={state.ok
      ? "rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-200"
      : "rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100"}>{state.message}</p>
    {state.invitationUrl && <label className="block rounded-lg border border-white/10 bg-[#111612] p-3">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-white/55">One-time activation link · copy and send securely</span>
      <input readOnly value={state.invitationUrl} onFocus={(event) => event.currentTarget.select()} aria-label="One-time activation link"
        className="w-full select-all bg-transparent text-xs text-[#b6f36a] outline-none" />
      <span className="mt-2 block text-[10px] leading-4 text-white/35">Shown only in this response. It expires in 48 hours and becomes unusable after activation or re-issue.</span>
    </label>}
  </div>;
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


export function MemberCreateForm() {
  const [state, action, pending] = useActionState(createMemberAction, initial);
  return <section className="surface h-fit rounded-2xl p-5 md:p-6">
    <p className="eyebrow">New record</p>
    <h2 className="mt-2 text-lg font-extrabold">Add member</h2>
    <p className="mb-5 mt-2 text-xs leading-5 text-white/40">Creates an invitation-pending member and generates a single-use activation link. Copy the link and send it to the member through a trusted channel.</p>
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
  ["staff.manage", "Manage staff and assign permissions"],
  ["memberships.read", "View plans and memberships"],
  ["memberships.manage", "Manage plans and memberships"],
  ["attendance.read", "View attendance"],
  ["attendance.manage", "Manage attendance"],
  ["classes.read", "View classes"],
  ["classes.manage", "Manage classes"],
  ["finance.read", "View finance records"],
  ["finance.write", "Record payments"],
  ["reports.read", "View reports"],
  ["cms.manage", "Manage website content"],
  ["media.manage", "Manage media"],
  ["fitness.read", "View fitness plans and progress"],
  ["fitness.manage", "Manage workouts and diet plans"],
  ["settings.manage", "Manage gym settings"],
] as const;

export function StaffCreateForm() {
  const [state, action, pending] = useActionState(createStaffAction, initial);
  return <section className="surface h-fit rounded-2xl p-5 md:p-6">
    <p className="eyebrow">New team account</p>
    <h2 className="mt-2 text-lg font-extrabold">Add staff</h2>
    <p className="mb-5 mt-2 text-xs leading-5 text-white/40">Creates an invitation-pending staff account and a single-use activation link. Copy and send the link through a trusted channel.</p>
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


export function AttendanceCreateForm({ members }: { members: MemberOption[] }) {
  const [state, action, pending] = useActionState(recordAttendanceAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Daily check-in</p>
    <h2 className="mt-2 text-lg font-extrabold">Record attendance</h2>
    <form action={action} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-white/65">Active member</span>
        <select name="memberId" required defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white">
          <option value="" disabled>Select a member</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-white/65">Note (optional)</span>
        <textarea name="note" maxLength={300} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <button disabled={pending || !members.length} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Recording…" : "Record check-in"}</button>
    </form>
    <Notice state={state} />
    {!members.length && <p className="mt-3 text-[11px] text-white/35">Only active members with a valid membership today can be checked in.</p>}
  </section>;
}

export function GymClassCreateForm() {
  const [state, action, pending] = useActionState(createGymClassAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Class schedule</p>
    <h2 className="mt-2 text-lg font-extrabold">Schedule a class</h2>
    <p className="mt-2 text-xs leading-5 text-white/40">Times are interpreted in the the gym configured timezone. Published classes become available to members with an active membership.</p>
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Field label="Class name" name="name" required placeholder="Strength & conditioning" /></div>
      <Field label="Starts at" name="startsAt" type="datetime-local" required />
      <Field label="Ends at" name="endsAt" type="datetime-local" required />
      <Field label="Capacity" name="capacity" type="number" required min="1" placeholder="20" />
      <label className="block md:col-span-2">
        <span className="mb-2 block text-xs font-semibold text-white/65">Description (optional)</span>
        <textarea name="description" maxLength={500} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <div className="md:col-span-2"><button disabled={pending} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Scheduling…" : "Schedule and publish class"}</button></div>
    </form>
    <Notice state={state} />
  </section>;
}

export function ClassBookingForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState(bookGymClassAction, initial);
  return <form action={action} className="mt-4">
    <input type="hidden" name="classId" value={classId} />
    <button disabled={pending} className="rounded-full bg-[#b6f36a] px-4 py-2.5 text-[11px] font-black text-[#090b0a] disabled:opacity-50">{pending ? "Booking…" : "Book class"}</button>
    <p role="status" className="mt-2 text-[11px] text-white/50">{state.message}</p>
  </form>;
}

export function ClassBookingCancelForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState(cancelGymClassBookingAction, initial);
  return <form action={action} className="mt-4">
    <input type="hidden" name="classId" value={classId} />
    <button disabled={pending} className="rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-bold text-white/65 disabled:opacity-50">{pending ? "Cancelling…" : "Cancel booking"}</button>
    <p role="status" className="mt-2 text-[11px] text-white/50">{state.message}</p>
  </form>;
}


export function IssueInvitationForm({ targetId, accountType }: { targetId: string; accountType: "MEMBER" | "STAFF" }) {
  const [state, action, pending] = useActionState(issueAccountInvitationAction, initial);
  return <form action={action} className="mt-3 space-y-2">
    <input type="hidden" name="targetId" value={targetId} />
    <input type="hidden" name="accountType" value={accountType} />
    <button disabled={pending} className="rounded-full border border-[#b6f36a]/40 px-3 py-2 text-[10px] font-bold text-[#b6f36a] disabled:opacity-50">
      {pending ? "Generating…" : "Generate new activation link"}
    </button>
    <Notice state={state} />
  </form>;
}


export function MemberProfileForm({
  memberId,
  name,
  email,
  phone,
  emergencyContactName,
  emergencyContactPhone,
  dateOfBirth,
}: {
  memberId: string;
  name: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  dateOfBirth: string;
}) {
  const [state, action, pending] = useActionState(updateMemberProfileAction, initial);
  return <details className="mt-4 border-t border-white/10 pt-3">
    <summary className="cursor-pointer text-xs font-bold text-[#b6f36a]">Edit member profile</summary>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="memberId" value={memberId} />
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Full name</span>
        <input name="name" required minLength={2} maxLength={100} defaultValue={name}
          className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Email</span>
        <input name="email" type="email" required maxLength={254} defaultValue={email}
          className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Phone</span>
        <input name="phone" maxLength={24} defaultValue={phone}
          className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Date of birth</span>
        <input name="dateOfBirth" type="date" defaultValue={dateOfBirth}
          className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Emergency contact name</span>
        <input name="emergencyContactName" maxLength={100} defaultValue={emergencyContactName}
          className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Emergency contact phone</span>
        <input name="emergencyContactPhone" maxLength={24} defaultValue={emergencyContactPhone}
          className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <div className="sm:col-span-2">
        <button disabled={pending} className="rounded-full bg-[#b6f36a] px-4 py-2.5 text-[10px] font-black text-[#090b0a] disabled:opacity-50">
          {pending ? "Saving…" : "Save profile"}
        </button>
        <Notice state={state} />
      </div>
    </form>
  </details>;
}

export function StaffStatusForm({ staffId, nextStatus }: { staffId: string; nextStatus: "ACTIVE" | "SUSPENDED" }) {
  const [state, action, pending] = useActionState(updateStaffStatusAction, initial);
  return <div className="mt-3">
    <form action={action}>
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="status" value={nextStatus} />
      <button disabled={pending} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-bold text-white/65 transition hover:border-[#b6f36a]/50 hover:text-[#b6f36a] disabled:opacity-50">
        {pending ? "Saving…" : nextStatus === "SUSPENDED" ? "Suspend staff" : "Reactivate staff"}
      </button>
    </form>
    <Notice state={state} />
  </div>;
}


export function RefundCreateForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(recordRefundAction, initial);
  return <details className="mt-3">
    <summary className="cursor-pointer text-[10px] font-bold text-amber-200">Record refund</summary>
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <Field label="Refund amount (INR)" name="amount" required placeholder="250.00" />
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Returned via</span>
        <select name="method" required defaultValue="UPI" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white">
          <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
        </select>
      </label>
      <Field label="Reference (optional)" name="reference" placeholder="Refund reference" />
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Reason</span>
        <textarea name="note" required minLength={3} maxLength={500} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <div className="sm:col-span-2"><button disabled={pending} className="rounded-full border border-amber-300/30 px-4 py-2 text-[10px] font-bold text-amber-100 disabled:opacity-50">{pending ? "Recording…" : "Record refund"}</button><Notice state={state} /></div>
    </form>
  </details>;
}

export function AdjustmentCreateForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(recordAdjustmentAction, initial);
  return <details className="mt-3">
    <summary className="cursor-pointer text-[10px] font-bold text-[#b6f36a]">Record adjustment</summary>
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <Field label="Adjustment amount (INR)" name="amount" required placeholder="100.00" />
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Adjustment direction</span>
        <select name="direction" required defaultValue="DECREASE" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white">
          <option value="DECREASE">Decrease balance</option><option value="INCREASE">Increase balance</option>
        </select>
      </label>
      <Field label="Reference (optional)" name="reference" placeholder="Adjustment reference" />
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-[11px] font-semibold text-white/60">Reason</span>
        <textarea name="note" required minLength={3} maxLength={500} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white outline-none focus:border-[#b6f36a]/60" />
      </label>
      <div className="sm:col-span-2"><button disabled={pending} className="rounded-full border border-[#b6f36a]/30 px-4 py-2 text-[10px] font-bold text-[#b6f36a] disabled:opacity-50">{pending ? "Recording…" : "Record adjustment"}</button><Notice state={state} /></div>
    </form>
  </details>;
}


export function ArchiveMemberForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(archiveMemberAction, initial);
  return <details className="mt-3">
    <summary className="cursor-pointer text-[10px] font-bold text-red-200">Archive member</summary>
    <form action={action} className="mt-3 rounded-lg border border-red-300/15 bg-red-300/[0.04] p-3">
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-[11px] leading-5 text-white/55">This anonymizes the personal profile, revokes sessions and links, and retains financial and membership records for reconciliation. This cannot be undone.</p>
      <button disabled={pending} className="mt-3 rounded-full border border-red-300/30 px-4 py-2 text-[10px] font-bold text-red-100 disabled:opacity-50">{pending ? "Archiving…" : "Confirm archive"}</button>
      <Notice state={state} />
    </form>
  </details>;
}


export function WorkoutPlanCreateForm({ members }: { members: MemberOption[] }) {
  const [state, action, pending] = useActionState(createWorkoutPlanAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Training plan</p>
    <h2 className="mt-2 text-lg font-extrabold">Assign workout plan</h2>
    <form action={action} className="mt-5 space-y-3">
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Member</span><select name="memberId" required defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white"><option value="" disabled>Select member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></label>
      <Field label="Plan title" name="title" required placeholder="Beginner strength plan" />
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Description (optional)</span><textarea name="description" maxLength={1000} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white" /></label>
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Exercises / instructions</span><textarea name="exerciseInstructions" required minLength={2} maxLength={4000} rows={5} placeholder={"Squat — 3 sets × 10 reps\nPush-up — 3 sets × 8 reps"} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white outline-none focus:border-[#b6f36a]/60" /></label>
      <button disabled={pending || !members.length} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Assigning…" : "Assign workout plan"}</button>
    </form>
    <Notice state={state} />
  </section>;
}

export function DietPlanCreateForm({ members }: { members: MemberOption[] }) {
  const [state, action, pending] = useActionState(createDietPlanAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Nutrition targets</p>
    <h2 className="mt-2 text-lg font-extrabold">Assign diet targets</h2>
    <p className="mt-2 text-xs leading-5 text-white/40">General fitness targets only. Medical nutrition therapy must be handled by a qualified professional.</p>
    <form action={action} className="mt-5 space-y-3">
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Member</span><select name="memberId" required defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white"><option value="" disabled>Select member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}</select></label>
      <Field label="Plan title" name="title" required placeholder="Balanced nutrition targets" />
      <div className="grid grid-cols-2 gap-3"><Field label="Calories / day" name="targetCalories" type="number" required min="500" placeholder="2200" /><Field label="Protein (g)" name="proteinGrams" type="number" required min="0" placeholder="140" /><Field label="Carbs (g)" name="carbsGrams" type="number" required min="0" placeholder="220" /><Field label="Fat (g)" name="fatGrams" type="number" required min="0" placeholder="70" /></div>
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Notes (optional)</span><textarea name="notes" maxLength={2000} rows={3} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white" /></label>
      <button disabled={pending || !members.length} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Assigning…" : "Assign diet targets"}</button>
    </form>
    <Notice state={state} />
  </section>;
}

export function WorkoutSessionLogForm({ planId }: { planId: string }) {
  const [state, action, pending] = useActionState(logWorkoutSessionAction, initial);
  return <form action={action} className="mt-4 space-y-2 rounded-xl border border-white/10 p-3">
    <input type="hidden" name="planId" value={planId} />
    <Field label="Duration (minutes, optional)" name="durationMinutes" type="number" min="1" placeholder="45" />
    <label className="block"><span className="mb-2 block text-[11px] font-semibold text-white/60">Session note (optional)</span><input name="notes" maxLength={500} className="w-full rounded-lg border border-white/10 bg-[#111612] px-3 py-2.5 text-xs text-white" /></label>
    <button disabled={pending} className="rounded-full bg-[#b6f36a] px-4 py-2.5 text-[10px] font-black text-[#090b0a] disabled:opacity-50">{pending ? "Saving…" : "Log completed session"}</button>
    <Notice state={state} />
  </form>;
}

export function ProgressEntryForm() {
  const [state, action, pending] = useActionState(recordFitnessProgressAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Progress tracking</p>
    <h2 className="mt-2 text-lg font-extrabold">Record measurement</h2>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Metric</span><select name="metric" required defaultValue="WEIGHT_KG" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3 py-3 text-xs text-white"><option value="WEIGHT_KG">Weight (kg)</option><option value="BODY_FAT_PERCENT">Body fat (%)</option><option value="WAIST_CM">Waist (cm)</option><option value="CHEST_CM">Chest (cm)</option></select></label>
      <Field label="Measurement" name="value" required placeholder="75.5" />
      <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-white/65">Note (optional)</span><textarea name="note" maxLength={300} rows={2} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3 py-3 text-xs text-white" /></label>
      <div className="sm:col-span-2"><button disabled={pending} className="rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Saving…" : "Save measurement"}</button><Notice state={state} /></div>
    </form>
  </section>;
}

export function AnnouncementCreateForm() {
  const [state, action, pending] = useActionState(createAnnouncementAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Gym updates</p><h2 className="mt-2 text-lg font-extrabold">Publish announcement</h2>
    <form action={action} className="mt-4 space-y-3">
      <Field label="Title" name="title" required placeholder="Holiday opening hours" />
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Message</span><textarea name="body" required minLength={2} maxLength={2000} rows={4} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white" /></label>
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Audience</span><select name="audience" defaultValue="MEMBERS" className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-xs text-white"><option value="MEMBERS">Members</option><option value="ALL">All gym users</option></select></label>
      <button disabled={pending} className="w-full rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Publishing…" : "Publish announcement"}</button>
    </form><Notice state={state} />
  </section>;
}

export function GymWebsiteSettingsForm({ settings }: { settings: {
  heroTitle: string; heroSubtitle: string; aboutText: string; facilitiesText: string;
  address: string; contactEmail: string; contactPhone: string; isPublished: boolean;
} }) {
  const [state, action, pending] = useActionState(updateGymWebsiteAction, initial);
  return <section className="surface rounded-2xl p-5 md:p-6">
    <p className="eyebrow">Public gym website</p><h2 className="mt-2 text-lg font-extrabold">Website content</h2>
    <p className="mt-2 text-xs leading-5 text-white/40">Edits text and contact details for your public gym page. Image/video uploads require a configured storage provider and are not enabled.</p>
    <form action={action} className="mt-5 space-y-3">
      <Field label="Hero title" name="heroTitle" required placeholder="Train with intent." />
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Hero subtitle</span><textarea name="heroSubtitle" required maxLength={300} rows={2} defaultValue={settings.heroSubtitle} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white" /></label>
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">About the gym</span><textarea name="aboutText" required maxLength={2000} rows={4} defaultValue={settings.aboutText} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white" /></label>
      <label className="block"><span className="mb-2 block text-xs font-semibold text-white/65">Facilities (one per line)</span><textarea name="facilitiesText" maxLength={1500} rows={4} defaultValue={settings.facilitiesText} className="w-full rounded-xl border border-white/10 bg-[#111612] px-3.5 py-3 text-sm text-white" /></label>
      <Field label="Address" name="address" placeholder="Gym address" />
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Contact email" name="contactEmail" type="email" placeholder="hello@example.com" /><Field label="Contact phone" name="contactPhone" placeholder="+91..." /></div>
      <label className="flex items-center gap-2 text-xs text-white/65"><input type="checkbox" name="isPublished" defaultChecked={settings.isPublished} className="accent-[#b6f36a]" /> Publish the public gym page</label>
      <button disabled={pending} className="w-full rounded-full bg-[#b6f36a] px-5 py-3.5 text-xs font-black text-[#090b0a] disabled:opacity-50">{pending ? "Saving…" : "Save website settings"}</button>
    </form><Notice state={state} />
  </section>;
}
