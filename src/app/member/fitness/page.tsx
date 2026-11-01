import { Role } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { ProgressEntryForm, WorkoutSessionLogForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export default async function MemberFitnessPage() {
  const user = await requireRole(Role.MEMBER);
  if (!user.gymId) return <AppShell eyebrow="Member space" title="My fitness" description="Your account is not linked to a gym." userName={user.name} roleLabel="Member" />;

  const [workouts, diets, progress] = await Promise.all([
    prisma.workoutPlan.findMany({
      where: { gymId: user.gymId, memberId: user.id, isActive: true },
      include: { sessions: { orderBy: { completedAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.dietPlan.findMany({
      where: { gymId: user.gymId, memberId: user.id, isActive: true },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
    prisma.progressEntry.findMany({
      where: { gymId: user.gymId, memberId: user.id },
      orderBy: { measuredAt: "desc" },
      take: 30,
    }),
  ]);
  const timeZone = user.gym?.timezone ?? "Asia/Kolkata";

  return <AppShell eyebrow="Member space / Fitness" title="My fitness" description="View your assigned workout and nutrition targets, log completed sessions and record your own progress measurements." userName={user.name} roleLabel="Member">
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="surface rounded-2xl p-5 md:p-6">
        <h2 className="mb-4 text-lg font-extrabold">My workout plans</h2>
        {workouts.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No workout plans assigned yet. Ask your coach.</p> : <div className="space-y-4">
          {workouts.map((plan) => <article key={plan.id} className="rounded-xl border border-white/10 p-4">
            <h3 className="font-bold">{plan.title}</h3>
            {plan.description && <p className="mt-2 text-xs text-white/45">{plan.description}</p>}
            <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-white/75">{plan.exerciseInstructions}</p>
            <WorkoutSessionLogForm planId={plan.id} />
            <div className="mt-3 border-t border-white/5 pt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Recent sessions</p>
              {plan.sessions.length ? plan.sessions.map((session) => <p key={session.id} className="mt-2 text-[11px] text-white/50">{session.completedAt.toLocaleString("en-IN", { timeZone })}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}</p>) : <p className="mt-2 text-[11px] text-white/35">No sessions logged.</p>}
            </div>
          </article>)}
        </div>}
      </section>
      <section className="surface rounded-2xl p-5 md:p-6">
        <h2 className="mb-4 text-lg font-extrabold">Nutrition targets</h2>
        {diets.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No active nutrition targets assigned.</p> : <div className="space-y-3">
          {diets.map((diet) => <article key={diet.id} className="rounded-xl border border-white/10 p-4">
            <h3 className="font-bold">{diet.title}</h3>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <div><p className="font-black text-[#b6f36a]">{diet.targetCalories}</p><p className="text-[9px] text-white/35">kcal</p></div>
              <div><p className="font-black">{diet.proteinGrams}g</p><p className="text-[9px] text-white/35">protein</p></div>
              <div><p className="font-black">{diet.carbsGrams}g</p><p className="text-[9px] text-white/35">carbs</p></div>
              <div><p className="font-black">{diet.fatGrams}g</p><p className="text-[9px] text-white/35">fat</p></div>
            </div>
            {diet.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-white/50">{diet.notes}</p>}
          </article>)}
        </div>}
        <p className="mt-4 text-[10px] leading-5 text-white/35">Nutrition targets are general fitness guidance, not medical advice.</p>
      </section>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <ProgressEntryForm />
      <section className="surface rounded-2xl p-5 md:p-6">
        <h2 className="mb-4 text-lg font-extrabold">My progress history</h2>
        {progress.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No measurements recorded yet.</p> : <div className="space-y-2">
          {progress.map((entry) => <div key={entry.id} className="flex justify-between gap-3 border-b border-white/5 py-3 text-sm"><div><p className="font-semibold">{entry.metric.replaceAll("_", " ")}</p><p className="text-[10px] text-white/40">{entry.measuredAt.toLocaleDateString("en-IN", { timeZone })}</p></div><p className="font-black text-[#b6f36a]">{entry.value} {entry.unit}</p></div>)}
        </div>}
      </section>
    </div>
  </AppShell>;
}
