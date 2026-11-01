import Link from "next/link";
import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { GymWebsiteSettingsForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { requireGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function OwnerWebsitePage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations / Website" title="Website content" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;
  try { await requireGymPermission(user.id, user.gymId, "cms.manage"); }
  catch { return <AppShell eyebrow="Gym operations / Website" title="Access restricted" description="You do not have permission to manage public gym content." userName={user.name} roleLabel="Gym staff" />; }

  const settings = await prisma.gymWebsite.findUnique({ where: { gymId: user.gymId } });
  const defaults = {
    heroTitle: settings?.heroTitle ?? "Train with intent.",
    heroSubtitle: settings?.heroSubtitle ?? "A stronger gym experience built around your goals.",
    aboutText: settings?.aboutText ?? "Tell members what makes your gym different.",
    facilitiesText: settings?.facilitiesText ?? "Strength training\nGroup classes\nPersonal coaching",
    address: settings?.address ?? "",
    contactEmail: settings?.contactEmail ?? "",
    contactPhone: settings?.contactPhone ?? "",
    isPublished: settings?.isPublished ?? false,
  };
  return <AppShell eyebrow="Gym operations / CMS" title="Website content" description="Manage the text and contact details on your gym's public page. Media uploads are disabled until a private storage provider is configured." userName={user.name} roleLabel="Owner / Staff">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-white/45">Public URL: /gym/{user.gym?.slug ?? "your-gym"}</p>
      {settings?.isPublished && user.gym?.slug && <Link href={`/gym/${user.gym.slug}`} target="_blank" className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-[#b6f36a]">Preview public website</Link>}
    </div>
    <GymWebsiteSettingsForm settings={defaults} />
  </AppShell>;
}
