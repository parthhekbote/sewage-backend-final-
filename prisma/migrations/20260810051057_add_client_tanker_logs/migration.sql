-- AlterTable
ALTER TABLE "TankerLog" ADD COLUMN     "clientId" TEXT,
ALTER COLUMN "operatorId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "TankerLog_clientId_idx" ON "TankerLog"("clientId");

-- AddForeignKey
ALTER TABLE "TankerLog" ADD CONSTRAINT "TankerLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
