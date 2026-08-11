CREATE TYPE "DesludgingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "DesludgingRecord" (
    "id" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "DesludgingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "volume" DOUBLE PRECISION,
    "volumeUnit" TEXT NOT NULL DEFAULT 'kL',
    "agency" TEXT,
    "tankerNumber" TEXT,
    "notes" TEXT,
    "receiptImageUrl" TEXT,
    "plantId" TEXT NOT NULL,
    "scheduledById" TEXT NOT NULL,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DesludgingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DesludgingRecord_plantId_idx" ON "DesludgingRecord"("plantId");
CREATE INDEX "DesludgingRecord_status_idx" ON "DesludgingRecord"("status");
CREATE INDEX "DesludgingRecord_scheduledAt_idx" ON "DesludgingRecord"("scheduledAt");
CREATE INDEX "DesludgingRecord_scheduledById_idx" ON "DesludgingRecord"("scheduledById");
CREATE INDEX "DesludgingRecord_completedById_idx" ON "DesludgingRecord"("completedById");

ALTER TABLE "DesludgingRecord" ADD CONSTRAINT "DesludgingRecord_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesludgingRecord" ADD CONSTRAINT "DesludgingRecord_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesludgingRecord" ADD CONSTRAINT "DesludgingRecord_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
