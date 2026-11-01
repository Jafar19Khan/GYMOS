import Link from "next/link";
import { Role, UserStatus } from "@prisma/client";
import AppShell from "@/app/components/app-shell";
import { ArchiveMemberForm, IssueInvitationForm, MemberCreateForm, MemberProfileForm, MemberStatusForm } from "@/app/owner/components/operation-forms";
import { requireRole } from "@/lib/auth/guards";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function MembersPage({ searchParams }: PageProps) {
  const user = await requireRole(Role.OWNER);
  if (!user.gymId) return <AppShell eyebrow="Gym operations" title="Members" description="Your account is not linked to a gym." userName={user.name} roleLabel="Owner" />;

  const canRead = await hasGymPermission(user.id, user.gymId, "members.read");
  if (!canRead) return <AppShell eyebrow="Gym operations" title="Members" description="You do not have permission to view member records." userName={user.name} roleLabel="Gym staff" />;

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const pageSize = 20;
  const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where = {
    gymId: user.gymId,
    role: Role.MEMBER,
    status: { not: UserStatus.ARCHIVED },
    ...(query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { email: { contains: query, mode: "insensitive" as const } },
        { memberProfile: { is: { phone: { contains: query, mode: "insensitive" as const } } } },
      ],
    } : {}),
  };

  const [total, canWrite, canSuspend, canArchive, canExport] = await Promise.all([
    prisma.user.count({ where }),
    hasGymPermission(user.id, user.gymId, "members.write"),
    hasGymPermission(user.id, user.gymId, "members.suspend"),
    hasGymPermission(user.id, user.gymId, "members.delete"),
    hasGymPermission(user.id, user.gymId, "members.export"),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(pageNumber, totalPages);
  const members = await prisma.user.findMany({
    where,
    include: {
      memberProfile: true,
      memberships: { orderBy: { endDate: "desc" }, take: 1, include: { plan: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });
  const queryString = query ? `q=${encodeURIComponent(query)}&` : "";
  const previousHref = `/owner/members?${queryString}page=${Math.max(1, currentPage - 1)}`;
  const nextHref = `/owner/members?${queryString}page=${Math.min(totalPages, currentPage + 1)}`;

  return <AppShell eyebrow="Gym operations / People" title="Members" description="Search, update and manage member records. Archiving anonymizes personal data while retaining financial and membership history." userName={user.name} roleLabel="Owner / Staff">
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,.75fr)_minmax(0,1.5fr)]">
      {canWrite && <MemberCreateForm />}
      <section className="surface rounded-2xl p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-extrabold">Member directory</h2><p className="mt-1 text-xs text-white/40">{total} matching records</p></div>
          {canExport && <Link href={`/api/owner/members/export${query ? `?q=${encodeURIComponent(query)}` : ""}`} className="rounded-full border border-white/15 px-4 py-2.5 text-[10px] font-bold text-[#b6f36a]">Export CSV</Link>}
        </div>
        <form method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
          <input name="q" type="search" maxLength={100} defaultValue={query} placeholder="Search name, email or phone"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111612] px-4 py-3 text-xs text-white outline-none focus:border-[#b6f36a]/50" />
          <button className="rounded-full bg-[#b6f36a] px-5 py-3 text-xs font-black text-[#090b0a]">Search</button>
          {query && <Link href="/owner/members" className="rounded-full border border-white/15 px-5 py-3 text-center text-xs font-bold text-white/60">Clear</Link>}
        </form>
        {members.length === 0 ? <p className="py-10 text-center text-sm text-white/40">No member records match this search.</p> : <div className="space-y-3">
          {members.map((member) => {
            const membership = member.memberships[0];
            return <article key={member.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="truncate font-bold">{member.name}</p>
                  <p className="mt-1 truncate text-xs text-white/45">{member.email}</p>
                  <p className="mt-2 text-xs text-white/50">{member.memberProfile?.phone ?? "No phone"} · {membership?.plan.name ?? "No membership"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={member.status === UserStatus.ACTIVE ? "rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-bold text-emerald-300" : "rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-200"}>{member.status}</span>
                  {canSuspend && (member.status === UserStatus.ACTIVE || member.status === UserStatus.SUSPENDED) && <MemberStatusForm memberId={member.id} nextStatus={member.status === UserStatus.SUSPENDED ? "ACTIVE" : "SUSPENDED"} />}
                  {member.status === UserStatus.INVITED && canWrite && <IssueInvitationForm targetId={member.id} accountType="MEMBER" />}
                  {canArchive && <ArchiveMemberForm memberId={member.id} />}
                </div>
              </div>
              {canWrite && <MemberProfileForm
                memberId={member.id}
                name={member.name}
                email={member.email}
                phone={member.memberProfile?.phone ?? ""}
                emergencyContactName={member.memberProfile?.emergencyContactName ?? ""}
                emergencyContactPhone={member.memberProfile?.emergencyContactPhone ?? ""}
                dateOfBirth={member.memberProfile?.dateOfBirth?.toISOString().slice(0, 10) ?? ""}
              />}
            </article>;
          })}
        </div>}
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <p className="text-[10px] text-white/40">Page {currentPage} of {totalPages} · {pageSize} per page</p>
          <div className="flex gap-2">
            <Link aria-disabled={currentPage <= 1} href={previousHref} className={currentPage <= 1 ? "pointer-events-none rounded-full border border-white/5 px-4 py-2 text-[10px] text-white/20" : "rounded-full border border-white/15 px-4 py-2 text-[10px] text-white/65"}>Previous</Link>
            <Link aria-disabled={currentPage >= totalPages} href={nextHref} className={currentPage >= totalPages ? "pointer-events-none rounded-full border border-white/5 px-4 py-2 text-[10px] text-white/20" : "rounded-full border border-white/15 px-4 py-2 text-[10px] text-white/65"}>Next</Link>
          </div>
        </div>
      </section>
    </div>
  </AppShell>;
}
