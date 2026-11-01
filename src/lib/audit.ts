import "server-only";

import { prisma } from "@/lib/prisma";

type AuditEventInput = {
  actorId?: string | null;
  gymId?: string | null;
  event: string;
  resourceType: string;
  resourceId?: string | null;
};

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      gymId: input.gymId ?? null,
      event: input.event,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
    },
  });
}
