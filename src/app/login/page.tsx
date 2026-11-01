import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, ShieldCheck } from "lucide-react";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Secure sign in to your GYMOS workspace.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_.85fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#111612] p-12 lg:flex">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-[#39c98a]/10 blur-[110px]" />
        <Link href="/" className="relative flex items-center gap-3 text-xl font-black tracking-[-.08em]">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#b6f36a] text-[#090b0a]"><Dumbbell size={19} /></span>
          GYMOS<span className="text-[#b6f36a]">.</span>
        </Link>
        <div className="relative max-w-xl">
          <p className="eyebrow">Your work. Your progress.</p>
          <h1 className="mt-6 text-6xl font-black leading-[.95] tracking-[-.07em]">WELCOME<br />BACK TO<br /><span className="text-[#b6f36a]">YOUR BEST.</span></h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/50">One secure workspace for your gym operations and your personal fitness journey.</p>
        </div>
        <p className="relative text-xs text-white/35">GYMOS / Secure workspace</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-12 flex items-center gap-2 text-lg font-black tracking-[-.08em] lg:hidden"><Dumbbell className="text-[#b6f36a]" /> GYMOS<span className="text-[#b6f36a]">.</span></Link>
          <div className="mb-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#b6f36a]/10 text-[#b6f36a]"><ShieldCheck size={24} /></div>
            <p className="eyebrow">Account access</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Sign in to GYMOS</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">Use the account credentials provided by your gym or platform administrator.</p>
          </div>
          {params.activated === "1" && <p role="status" className="mb-5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">Your account is active. Sign in with the password you just created.</p>}
          <LoginForm />
          <p className="mt-8 text-center text-xs leading-6 text-white/35">Access is invitation-only. Public self-registration is disabled for security.</p>
        </div>
      </section>
    </main>
  );
}
