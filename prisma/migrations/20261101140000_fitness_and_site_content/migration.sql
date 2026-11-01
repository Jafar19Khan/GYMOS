CREATE TABLE "workout_plans" (
  "id" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "exerciseInstructions" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workout_plans_gymId_memberId_isActive_idx" ON "workout_plans"("gymId", "memberId", "isActive");
CREATE INDEX "workout_plans_memberId_createdAt_idx" ON "workout_plans"("memberId", "createdAt");
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "workout_sessions" (
  "id" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "workoutPlanId" UUID NOT NULL,
  "durationMinutes" INTEGER,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workout_sessions_gymId_memberId_completedAt_idx" ON "workout_sessions"("gymId", "memberId", "completedAt");
CREATE INDEX "workout_sessions_workoutPlanId_completedAt_idx" ON "workout_sessions"("workoutPlanId", "completedAt");
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "workout_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "diet_plans" (
  "id" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "targetCalories" INTEGER NOT NULL,
  "proteinGrams" INTEGER NOT NULL,
  "carbsGrams" INTEGER NOT NULL,
  "fatGrams" INTEGER NOT NULL,
  "notes" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "diet_plans_gymId_memberId_isActive_idx" ON "diet_plans"("gymId", "memberId", "isActive");
CREATE INDEX "diet_plans_memberId_startsAt_idx" ON "diet_plans"("memberId", "startsAt");
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "progress_entries" (
  "id" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "recordedById" UUID,
  "metric" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "note" TEXT,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "progress_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "progress_entries_gymId_memberId_metric_measuredAt_idx" ON "progress_entries"("gymId", "memberId", "metric", "measuredAt");
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "announcements" (
  "id" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'MEMBERS',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_gymId_publishedAt_idx" ON "announcements"("gymId", "publishedAt");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "gym_websites" (
  "id" UUID NOT NULL,
  "gymId" UUID NOT NULL,
  "heroTitle" TEXT NOT NULL,
  "heroSubtitle" TEXT NOT NULL,
  "aboutText" TEXT NOT NULL,
  "facilitiesText" TEXT NOT NULL,
  "address" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gym_websites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gym_websites_gymId_key" ON "gym_websites"("gymId");
ALTER TABLE "gym_websites" ADD CONSTRAINT "gym_websites_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
