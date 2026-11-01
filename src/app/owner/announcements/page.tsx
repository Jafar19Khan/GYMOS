import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { AnnouncementCreateForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { requireGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function OwnerAnnouncementsPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations" title="Announcements" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;
  try { await requireGymPermission(user.id, user.gymId, "cms.manage"); }
  catch { return <AppShell eyebrow="Gym operations / Updates" title="Access restricted" description="You do not have permission to publish gym announcements." userName={user.name} roleLabel="Gym staff" />; }

  const items = await prisma.announcement.findMany({
    where: { gymId: user.gymId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return <AppShell eyebrow="Gym operations / Communication" title="Announcements" description="Publish updates for members. Published notices appear in the Member workspace." userName={user.name} roleLabel="Owner / Staff">
    <div className="mb-6"><AnnouncementCreateForm /></div>
    <section className="surface rounded-2xl p-5 md:p-6">
      <h2 className="mb-4 text-lg font-extrabold">Recent announcements</h2>
      {items.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No announcements published yet.</p> : <div className="space-y-3">
        {items.map((item) => <article key={item.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{item.title}</h3><span className="text-[10px] uppercase tracking-wider text-[#b6f36a]">{item.audience}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{item.body}</p>
          <p className="mt-3 text-[10px] text-white/35">{item.publishedAt ? `Published ${item.publishedAt.toLocaleString("en-IN", { timeZone: user.gym?.timezone ?? "Asia/Kolkata" })}` : "Draft"}</p>
        </article>)}
      </div>}
    </section>
  </AppShell>;
}
