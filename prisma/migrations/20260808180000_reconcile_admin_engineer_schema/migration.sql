-- Reconcile the existing Admin database with the combined
-- Admin + Engineer Prisma schema without deleting existing data.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN
  CREATE TYPE "TaskStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "VisitCondition" AS ENUM (
    'HEALTHY',
    'NEEDS_ATTENTION',
    'CRITICAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "EquipmentCondition" AS ENUM (
    'FIXED',
    'NEEDS_MONITORING',
    'FURTHER_REPAIR_REQUIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================
-- EXISTING TABLE UPDATES
-- ============================================================

ALTER TABLE "Sensor"
ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Ticket"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- The current Admin schema keeps email required and phone optional.
ALTER TABLE "User"
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- ============================================================
-- PLANT METRICS
-- This table already exists in the live database but must also
-- exist when Prisma reconstructs the schema from migrations.
-- ============================================================

CREATE TABLE IF NOT EXISTS "PlantMetrics" (
  "id" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "treatedWater" DOUBLE PRECISION,
  "flowRate" DOUBLE PRECISION,
  "energyConsumption" DOUBLE PRECISION,
  "complianceScore" INTEGER DEFAULT 100,
  "violations" INTEGER DEFAULT 0,
  "lastDesludging" TIMESTAMP(3),
  "nextDesludging" TIMESTAMP(3),
  "sensorsOnline" INTEGER DEFAULT 0,
  "sensorsTotal" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlantMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlantMetrics_plantId_key"
ON "PlantMetrics"("plantId");

CREATE INDEX IF NOT EXISTS "PlantMetrics_plantId_idx"
ON "PlantMetrics"("plantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PlantMetrics_plantId_fkey'
  ) THEN
    ALTER TABLE "PlantMetrics"
    ADD CONSTRAINT "PlantMetrics_plantId_fkey"
    FOREIGN KEY ("plantId")
    REFERENCES "Plant"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- TASK
-- ============================================================

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3),
  "plantId" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Task_plantId_idx"
ON "Task"("plantId");

CREATE INDEX IF NOT EXISTS "Task_operatorId_idx"
ON "Task"("operatorId");

CREATE INDEX IF NOT EXISTS "Task_status_idx"
ON "Task"("status");

CREATE INDEX IF NOT EXISTS "Task_dueAt_idx"
ON "Task"("dueAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Task_plantId_fkey'
  ) THEN
    ALTER TABLE "Task"
    ADD CONSTRAINT "Task_plantId_fkey"
    FOREIGN KEY ("plantId")
    REFERENCES "Plant"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Task_operatorId_fkey'
  ) THEN
    ALTER TABLE "Task"
    ADD CONSTRAINT "Task_operatorId_fkey"
    FOREIGN KEY ("operatorId")
    REFERENCES "User"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- VISIT REPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS "VisitReport" (
  "id" TEXT NOT NULL,
  "observation" TEXT NOT NULL,
  "condition" "VisitCondition" NOT NULL,
  "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "plantId" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VisitReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VisitReport_plantId_idx"
ON "VisitReport"("plantId");

CREATE INDEX IF NOT EXISTS "VisitReport_engineerId_idx"
ON "VisitReport"("engineerId");

CREATE INDEX IF NOT EXISTS "VisitReport_condition_idx"
ON "VisitReport"("condition");

CREATE INDEX IF NOT EXISTS "VisitReport_visitedAt_idx"
ON "VisitReport"("visitedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VisitReport_plantId_fkey'
  ) THEN
    ALTER TABLE "VisitReport"
    ADD CONSTRAINT "VisitReport_plantId_fkey"
    FOREIGN KEY ("plantId")
    REFERENCES "Plant"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VisitReport_engineerId_fkey'
  ) THEN
    ALTER TABLE "VisitReport"
    ADD CONSTRAINT "VisitReport_engineerId_fkey"
    FOREIGN KEY ("engineerId")
    REFERENCES "User"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- WORK REPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS "WorkReport" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actionsTaken" TEXT NOT NULL,
  "partsReplaced" TEXT,
  "equipmentCondition" "EquipmentCondition" NOT NULL,
  "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "ticketId" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkReport_ticketId_idx"
ON "WorkReport"("ticketId");

CREATE INDEX IF NOT EXISTS "WorkReport_engineerId_idx"
ON "WorkReport"("engineerId");

CREATE INDEX IF NOT EXISTS "WorkReport_equipmentCondition_idx"
ON "WorkReport"("equipmentCondition");

CREATE INDEX IF NOT EXISTS "WorkReport_createdAt_idx"
ON "WorkReport"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkReport_ticketId_engineerId_key"
ON "WorkReport"("ticketId", "engineerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkReport_ticketId_fkey'
  ) THEN
    ALTER TABLE "WorkReport"
    ADD CONSTRAINT "WorkReport_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "Ticket"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkReport_engineerId_fkey'
  ) THEN
    ALTER TABLE "WorkReport"
    ADD CONSTRAINT "WorkReport_engineerId_fkey"
    FOREIGN KEY ("engineerId")
    REFERENCES "User"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;