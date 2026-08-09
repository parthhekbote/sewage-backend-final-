-- AlterTable
ALTER TABLE "ManualTestResult" ADD COLUMN     "operatorId" TEXT,
ALTER COLUMN "engineerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ManualTestResult_operatorId_idx" ON "ManualTestResult"("operatorId");

-- AddForeignKey
ALTER TABLE "ManualTestResult" ADD CONSTRAINT "ManualTestResult_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
