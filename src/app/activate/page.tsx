import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, ShieldCheck } from "lucide-react";
import ActivationForm from "./activation-form";
import { hashInvitationToken, isInvitationTokenFormat, isInvitationUsable } from "@/lib/auth/invitations";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Activate account",
  description: "Set a password to activate your GYMOS account.",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ActivatePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" && isInvitationTokenFormat(params.token) ? params.token : null;
  const invitation = token ? await prisma.accountInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      user: {
        select: {
          name: true,
          role: true,
          status: true,
          gymId: true,
          isGymOwner: true,
          gym: { select: { name: true } },
        },
      },
    },
  }) : null;

  const usable = isInvitationUsable(invitation, new Date());

  return <main className="flex min-h-screen items-center justify-center px-6 py-12">
    <section className="w-full max-w-md">
      <Link href="/" className="mb-10 flex items-center justify-center gap-2 text-xl font-black tracking-[-.08em]">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#b6f36a] text-[#090b0a]"><Dumbbell size={19} /></span>
        GYMOS<span className="text-[#b6f36a]">.</span>
      </Link>
      <div className="surface rounded-2xl p-6 md:p-8">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#b6f36a]/10 text-[#b6f36a]"><ShieldCheck size={24} /></div>
        <p className="eyebrow">Secure account setup</p>
        {usable && invitation && token ? <>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Activate your account</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Set a password for <span className="font-semibold text-white">{invitation.user.name}</span> at {invitation.user.gym?.name ?? "your gym"}.
            This single-use invitation expires {invitation.expiresAt.toLocaleString("en-IN", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC.
          </p>
          <div className="mt-7"><ActivationForm token={token} /></div>
        </> : <>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Invitation unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">This invitation is invalid, expired, already used or revoked. Contact your gym and ask them to generate a new activation link.</p>
          <Link href="/login" className="mt-7 flex w-full items-center justify-center rounded-full border border-white/15 px-5 py-3.5 text-sm font-bold text-white/70 transition hover:border-[#b6f36a]/50 hover:text-[#b6f36a]">Back to sign in</Link>
        </>}
      </div>
    </section>
  </main>;
}
