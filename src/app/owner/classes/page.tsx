import { BookingStatus, Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { GymClassCreateForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function OwnerClassesPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations" title="Classes" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "classes.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Classes" title="Classes" description="You do not have permission to view class schedules." userName={user.name} roleLabel="Gym staff" />;

  const [classes, canManage] = await Promise.all([
    prisma.gymClass.findMany({
      where: { gymId: user.gymId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    hasGymPermission(user.id, user.gymId, "classes.manage"),
  ]);
  const bookingCounts = classes.length ? await prisma.classBooking.groupBy({
    by: ["classId", "status"],
    where: {
      gymId: user.gymId,
      classId: { in: classes.map((item) => item.id) },
      status: { in: [BookingStatus.BOOKED, BookingStatus.WAITLISTED] },
    },
    _count: { _all: true },
  }) : [];
  const countMap = new Map<string, { booked: number; waitlisted: number }>();
  for (const item of bookingCounts) {
    const current = countMap.get(item.classId) ?? { booked: 0, waitlisted: 0 };
    if (item.status === BookingStatus.BOOKED) current.booked = item._count._all;
    if (item.status === BookingStatus.WAITLISTED) current.waitlisted = item._count._all;
    countMap.set(item.classId, current);
  }
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";

  return <AppShell eyebrow="Gym operations / Schedule" title="Classes" description="Schedule upcoming classes and monitor confirmed bookings and the FIFO waitlist. Class capacity is enforced inside database transactions." userName={user.name} roleLabel="Owner / Staff">
    {canManage && <div className="mb-6"><GymClassCreateForm /></div>}
    <section className="surface rounded-2xl p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold">Upcoming classes</h2><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">{classes.length} shown</span></div>
      {classes.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No upcoming classes scheduled.</p> : <div className="space-y-3">
        {classes.map((item) => {
          const counts = countMap.get(item.id) ?? { booked: 0, waitlisted: 0 };
          return <article key={item.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.name}</h3><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-300">{item.isPublished ? "PUBLISHED" : "UNPUBLISHED"}</span></div>
                {item.description && <p className="mt-2 text-xs leading-5 text-white/45">{item.description}</p>}
                <p className="mt-2 text-xs text-white/55">{item.startsAt.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })} – {item.endsAt.toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-black text-[#b6f36a]">{counts.booked}</p><p className="text-[9px] uppercase tracking-wider text-white/35">Booked</p></div>
                <div><p className="text-lg font-black">{item.capacity}</p><p className="text-[9px] uppercase tracking-wider text-white/35">Capacity</p></div>
                <div><p className="text-lg font-black text-amber-200">{counts.waitlisted}</p><p className="text-[9px] uppercase tracking-wider text-white/35">Waitlist</p></div>
              </div>
            </div>
          </article>;
        })}
      </div>}
      <p className="mt-5 text-[11px] text-white/35">Only upcoming classes are displayed. Booked counts exclude cancelled bookings; waitlist order is oldest booking first.</p>
    </section>
  </AppShell>;
}
