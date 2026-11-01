"use client";

import { useActionState } from "react";
import { activateAccountAction, type ActivationActionState } from "@/app/actions/invitations";

const initialState: ActivationActionState = { ok: false, message: "" };

export default function ActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(activateAccountAction, initialState);

  return <form action={action} className="space-y-5">
    <input type="hidden" name="token" value={token} />
    <div>
      <label htmlFor="password" className="mb-2 block text-xs font-bold text-white/70">Create password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
        className="w-full rounded-xl border border-white/10 bg-[#171d19] px-4 py-3.5 text-sm text-white outline-none transition focus:border-[#b6f36a]/70"
        placeholder="At least 12 characters" />
    </div>
    <div>
      <label htmlFor="confirmPassword" className="mb-2 block text-xs font-bold text-white/70">Confirm password</label>
      <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
        className="w-full rounded-xl border border-white/10 bg-[#171d19] px-4 py-3.5 text-sm text-white outline-none transition focus:border-[#b6f36a]/70"
        placeholder="Enter the same password again" />
    </div>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok
      ? "rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200"
      : "rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"}>{state.message}</p>}
    <button type="submit" disabled={pending} className="flex w-full items-center justify-center rounded-full bg-[#b6f36a] px-5 py-4 text-sm font-black text-[#090b0a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? "Activating…" : "Activate account"}
    </button>
    <p className="text-center text-[11px] leading-5 text-white/35">Use at least 12 characters. Passwords are securely hashed and cannot be viewed by gym staff.</p>
  </form>;
}
