import { Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { DietPlanCreateForm, WorkoutPlanCreateForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function OwnerFitnessPage() {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations" title="Fitness plans" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;
  const canRead = await hasGymPermission(user.id, user.gymId, "fitness.read");
  if (!canRead) return <AppShell eyebrow="Gym operations / Fitness" title="Access restricted" description="You do not have permission to view fitness plans or progress data." userName={user.name} roleLabel="Gym staff" />;

  const [members, canManage, workouts, diets, progress] = await Promise.all([
    prisma.user.findMany({
      where: { gymId: user.gymId, role: Role.MEMBER, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    hasGymPermission(user.id, user.gymId, "fitness.manage"),
    prisma.workoutPlan.findMany({
      where: { gymId: user.gymId },
      include: { member: { select: { name: true, email: true } }, sessions: { orderBy: { completedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.dietPlan.findMany({
      where: { gymId: user.gymId, isActive: true },
      include: { member: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.progressEntry.findMany({
      where: { gymId: user.gymId },
      include: { member: { select: { name: true, email: true } } },
      orderBy: { measuredAt: "desc" },
      take: 50,
    }),
  ]);

  return <AppShell eyebrow="Gym operations / Coaching" title="Fitness plans" description="Assign workout and general nutrition targets, and review gym-scoped member progress. Fitness targets are not medical advice." userName={user.name} roleLabel="Owner / Staff">
    {canManage && <div className="mb-6 grid gap-6 xl:grid-cols-2"><WorkoutPlanCreateForm members={members} /><DietPlanCreateForm members={members} /></div>}
    <section className="surface rounded-2xl p-5 md:p-6">
      <h2 className="mb-4 text-lg font-extrabold">Assigned workout plans</h2>
      {workouts.length === 0 ? <p className="py-6 text-center text-sm text-white/40">No workout plans assigned yet.</p> : <div className="space-y-3">
        {workouts.map((plan) => <article key={plan.id} className="rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{plan.title}</h3><p className="mt-1 text-xs text-white/45">{plan.member.name} · {plan.member.email}</p></div><span className={plan.isActive ? "text-[10px] font-bold text-emerald-300" : "text-[10px] text-white/35"}>{plan.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
          {plan.description && <p className="mt-3 text-xs text-white/50">{plan.description}</p>}
          <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-white/70">{plan.exerciseInstructions}</p>
          <p className="mt-3 text-[10px] text-white/35">Last workout: {plan.sessions[0] ? plan.sessions[0].completedAt.toLocaleString("en-IN", { timeZone: user.gym?.timezone ?? "Asia/Kolkata" }) : "Not logged yet"}</p>
        </article>)}
      </div>}
    </section>
    <section className="surface mt-6 rounded-2xl p-5 md:p-6">
      <h2 className="mb-4 text-lg font-extrabold">Diet targets</h2>
      {diets.length === 0 ? <p className="py-6 text-center text-sm text-white/40">No active diet targets assigned.</p> : <div className="grid gap-3 md:grid-cols-2">
        {diets.map((diet) => <article key={diet.id} className="rounded-xl border border-white/10 p-4">
          <h3 className="font-bold">{diet.title}</h3><p className="mt-1 text-xs text-white/45">{diet.member.name}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <div><p className="font-black text-[#b6f36a]">{diet.targetCalories}</p><p className="text-[9px] text-white/35">kcal</p></div>
            <div><p className="font-black">{diet.proteinGrams}g</p><p className="text-[9px] text-white/35">protein</p></div>
            <div><p className="font-black">{diet.carbsGrams}g</p><p className="text-[9px] text-white/35">carbs</p></div>
            <div><p className="font-black">{diet.fatGrams}g</p><p className="text-[9px] text-white/35">fat</p></div>
          </div>
          {diet.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-white/50">{diet.notes}</p>}
        </article>)}
      </div>}
    </section>
    <section className="surface mt-6 rounded-2xl p-5 md:p-6">
      <h2 className="mb-4 text-lg font-extrabold">Recent progress entries</h2>
      {progress.length === 0 ? <p className="py-6 text-center text-sm text-white/40">No progress entries recorded.</p> : <div className="space-y-2">
        {progress.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-3 text-sm">
          <div><p className="font-bold">{entry.member.name}</p><p className="text-[10px] text-white/40">{entry.metric.replaceAll("_", " ")} · {entry.measuredAt.toLocaleDateString("en-IN", { timeZone: user.gym?.timezone ?? "Asia/Kolkata" })}</p></div><p className="text-lg font-black text-[#b6f36a]">{entry.value} {entry.unit}</p>
        </div>)}
      </div>}
      <p className="mt-4 text-[10px] text-white/35">Only the latest 50 plans/measurements are shown. Progress data is sensitive member information; access is limited to the fitness.read permission.</p>
    </section>
  </AppShell>;
}
