import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function MemberAnnouncementsPage() {
  const user = await requireRole(Role.MEMBER);
  if (!user.gymId) return <AppShell eyebrow="Member space" title="Announcements" description="Your account is not linked to a gym." userName={user.name} roleLabel="Member" />;
  const notices = await prisma.announcement.findMany({
    where: { gymId: user.gymId, publishedAt: { not: null }, audience: { in: ["MEMBERS", "ALL"] } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";
  return <AppShell eyebrow="Member space / Gym updates" title="Announcements" description="Updates published by your gym." userName={user.name} roleLabel="Member">
    <section className="surface rounded-2xl p-5 md:p-6">
      {notices.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No new announcements.</p> : <div className="space-y-3">{notices.map((item) => <article key={item.id} className="rounded-xl border border-white/10 p-4"><h2 className="font-bold">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{item.body}</p><p className="mt-3 text-[10px] text-white/35">{item.publishedAt?.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })}</p></article>)}</div>}
    </section>
  </AppShell>;
}
