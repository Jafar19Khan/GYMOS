CREATE TABLE "account_invitations" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_invitations_tokenHash_key" ON "account_invitations"("tokenHash");
CREATE INDEX "account_invitations_userId_expiresAt_idx" ON "account_invitations"("userId", "expiresAt");
CREATE INDEX "account_invitations_gymId_createdAt_idx" ON "account_invitations"("gymId", "createdAt");

ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_gymId_fkey"
  FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
