CREATE TYPE "PlantStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Plant"
ADD COLUMN "status" "PlantStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Plant_status_idx" ON "Plant"("status");
