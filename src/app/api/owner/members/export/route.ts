import { Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasGymPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

function csv(value: string | null | undefined): string {
  const normalized = value ?? "";
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.OWNER || !user.gymId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!(await hasGymPermission(user.id, user.gymId, "members.export"))) {
    return NextResponse.json({ error: "You do not have permission to export member records." }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
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
  const count = await prisma.user.count({ where });
  if (count > 5000) {
    return NextResponse.json({ error: "Export is limited to 5,000 records. Narrow your search first." }, { status: 413 });
  }

  const members = await prisma.user.findMany({
    where,
    include: { memberProfile: { select: { phone: true } } },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
  const rows = [
    ["Name", "Email", "Phone", "Status", "Created at"].map(csv).join(","),
    ...members.map((member) => [
      csv(member.name),
      csv(member.email),
      csv(member.memberProfile?.phone),
      csv(member.status),
      csv(member.createdAt.toISOString()),
    ].join(",")),
  ];

  return new Response(`\uFEFF${rows.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gymos-members-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
