import { BookingStatus, MembershipStatus, Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { ClassBookingCancelForm, ClassBookingForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { dateOnlyInTimeZone } from "@/lib/operations/dates";
import { prisma } from "@/lib/prisma";

export default async function MemberClassesPage() {
  const user = await requireRole(Role.MEMBER);
  if (!user.gymId) return <AppShell eyebrow="Member space" title="Classes" description="Your account is not linked to a gym." userName={user.name} roleLabel="Member" />;

  const now = new Date();
  const today = dateOnlyInTimeZone(now, user.gym?.timezone ?? "Asia/Kolkata");
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [membership, classes] = await Promise.all([
    prisma.membership.findFirst({
      where: {
        gymId: user.gymId,
        memberId: user.id,
        status: MembershipStatus.ACTIVE,
        startDate: { lte: todayDate },
        endDate: { gte: todayDate },
      },
      select: { id: true },
    }),
    prisma.gymClass.findMany({
      where: { gymId: user.gymId, isPublished: true, startsAt: { gt: now } },
      include: { bookings: { where: { memberId: user.id }, select: { status: true } } },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
  ]);
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";

  return <AppShell eyebrow="Member space / Group training" title="Class schedule" description="Browse upcoming gym classes and manage your own booking. An active membership is required to book." userName={user.name} roleLabel="Member">
    {!membership && <p className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-5 text-amber-100">Your membership is not active today. You can view the schedule, but class booking requires an active membership.</p>}
    <section className="surface rounded-2xl p-5 md:p-6">
      {classes.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No upcoming classes are available right now.</p> : <div className="space-y-3">
        {classes.map((item) => {
          const status = item.bookings[0]?.status;
          const canCancel = status === BookingStatus.BOOKED || status === BookingStatus.WAITLISTED;
          const canBook = !status || status === BookingStatus.CANCELLED;
          return <article key={item.id} className="rounded-xl border border-white/10 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h2 className="font-bold">{item.name}</h2>
                {item.description && <p className="mt-2 max-w-2xl text-xs leading-5 text-white/45">{item.description}</p>}
                <p className="mt-2 text-xs text-white/55">{item.startsAt.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" })} – {item.endsAt.toLocaleTimeString("en-IN", { timeZone, hour: "2-digit", minute: "2-digit" })}</p>
                <p className="mt-1 text-[11px] text-white/35">Capacity: {item.capacity}</p>
              </div>
              <div className="sm:text-right">
                {status && status !== BookingStatus.CANCELLED ? <span className={status === BookingStatus.BOOKED ? "rounded-full bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold text-emerald-300" : "rounded-full bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold text-amber-100"}>{status}</span> : <span className="text-[10px] text-white/35">Not booked</span>}
                {canBook && membership && <ClassBookingForm classId={item.id} />}
                {canBook && !membership && <p className="mt-3 text-[10px] text-white/35">Active membership required</p>}
                {canCancel && <ClassBookingCancelForm classId={item.id} />}
                {status === BookingStatus.ATTENDED && <p className="mt-3 text-[10px] text-white/35">Attendance recorded</p>}
              </div>
            </div>
          </article>;
        })}
      </div>}
    </section>
  </AppShell>;
}
