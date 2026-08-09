-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisitCondition" AS ENUM ('HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('FIXED', 'NEEDS_MONITORING', 'FURTHER_REPAIR_REQUIRED');

-- AlterTable
ALTER TABLE "Sensor" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Task" (
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

-- CreateTable
CREATE TABLE "VisitReport" (
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

-- CreateTable
CREATE TABLE "WorkReport" (
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

-- CreateIndex
CREATE INDEX "Task_plantId_idx" ON "Task"("plantId");

-- CreateIndex
CREATE INDEX "Task_operatorId_idx" ON "Task"("operatorId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "VisitReport_plantId_idx" ON "VisitReport"("plantId");

-- CreateIndex
CREATE INDEX "VisitReport_engineerId_idx" ON "VisitReport"("engineerId");

-- CreateIndex
CREATE INDEX "VisitReport_condition_idx" ON "VisitReport"("condition");

-- CreateIndex
CREATE INDEX "VisitReport_visitedAt_idx" ON "VisitReport"("visitedAt");

-- CreateIndex
CREATE INDEX "WorkReport_ticketId_idx" ON "WorkReport"("ticketId");

-- CreateIndex
CREATE INDEX "WorkReport_engineerId_idx" ON "WorkReport"("engineerId");

-- CreateIndex
CREATE INDEX "WorkReport_equipmentCondition_idx" ON "WorkReport"("equipmentCondition");

-- CreateIndex
CREATE INDEX "WorkReport_createdAt_idx" ON "WorkReport"("createdAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReport" ADD CONSTRAINT "VisitReport_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReport" ADD CONSTRAINT "VisitReport_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
