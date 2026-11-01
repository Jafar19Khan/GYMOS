CREATE TABLE "login_throttles" (
  "id" UUID NOT NULL,
  "keyHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "login_throttles_keyHash_key" ON "login_throttles"("keyHash");
CREATE INDEX "login_throttles_lockedUntil_idx" ON "login_throttles"("lockedUntil");
