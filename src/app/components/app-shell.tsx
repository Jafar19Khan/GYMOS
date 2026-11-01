import Link from "next/link";
import { Dumbbell, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

type AppShellProps = {
  title: string;
  description: string;
  eyebrow: string;
  userName: string;
  roleLabel: string;
  children: React.ReactNode;
};

export default function AppShell({
  title,
  description,
  eyebrow,
  userName,
  roleLabel,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#090b0a]">
      <header className="border-b border-white/10 bg-[#090b0a]/90">
        <div className="container-shell flex min-h-[76px] items-center justify-between gap-5">
          <Link href="/" className="flex items-center gap-3 text-lg font-black tracking-[-.08em]">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#b6f36a] text-[#090b0a]"><Dumbbell size={19} /></span>
            GYMOS<span className="text-[#b6f36a]">.</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-white">{userName}</p>
              <p className="text-[10px] uppercase tracking-[.16em] text-white/40">{roleLabel}</p>
            </div>
            <form action={signOutAction}>
              <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold text-white/70 transition hover:border-[#b6f36a]/50 hover:text-[#b6f36a]">
                <LogOut size={14} /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <section className="container-shell py-12 md:py-16">
        <div className="mb-10">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.06em] md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/50">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
