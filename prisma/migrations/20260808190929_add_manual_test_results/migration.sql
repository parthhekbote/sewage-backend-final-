-- CreateEnum
CREATE TYPE "ManualTestStatus" AS ENUM ('GOOD', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "ManualTestResult" (
    "id" TEXT NOT NULL,
    "ph" DOUBLE PRECISION NOT NULL,
    "bod" DOUBLE PRECISION NOT NULL,
    "cod" DOUBLE PRECISION NOT NULL,
    "doValue" DOUBLE PRECISION NOT NULL,
    "tss" DOUBLE PRECISION NOT NULL,
    "turbidity" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "status" "ManualTestStatus" NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tankId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualTestResult_tankId_idx" ON "ManualTestResult"("tankId");

-- CreateIndex
CREATE INDEX "ManualTestResult_engineerId_idx" ON "ManualTestResult"("engineerId");

-- CreateIndex
CREATE INDEX "ManualTestResult_status_idx" ON "ManualTestResult"("status");

-- CreateIndex
CREATE INDEX "ManualTestResult_testedAt_idx" ON "ManualTestResult"("testedAt");

-- CreateIndex
CREATE INDEX "ManualTestResult_tankId_testedAt_idx" ON "ManualTestResult"("tankId", "testedAt");

-- AddForeignKey
ALTER TABLE "ManualTestResult" ADD CONSTRAINT "ManualTestResult_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestResult" ADD CONSTRAINT "ManualTestResult_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
