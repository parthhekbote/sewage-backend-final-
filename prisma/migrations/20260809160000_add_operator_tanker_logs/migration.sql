-- CreateTable
CREATE TABLE "TankerLog" (
    "id" TEXT NOT NULL,
    "tankerNumber" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "volumeUnit" TEXT NOT NULL DEFAULT 'kL',
    "receiptImageUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "plantId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TankerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TankerLog_plantId_idx" ON "TankerLog"("plantId");

-- CreateIndex
CREATE INDEX "TankerLog_operatorId_idx" ON "TankerLog"("operatorId");

-- CreateIndex
CREATE INDEX "TankerLog_tankerNumber_idx" ON "TankerLog"("tankerNumber");

-- CreateIndex
CREATE INDEX "TankerLog_agency_idx" ON "TankerLog"("agency");

-- CreateIndex
CREATE INDEX "TankerLog_loggedAt_idx" ON "TankerLog"("loggedAt");

-- AddForeignKey
ALTER TABLE "TankerLog"
ADD CONSTRAINT "TankerLog_plantId_fkey"
FOREIGN KEY ("plantId") REFERENCES "Plant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankerLog"
ADD CONSTRAINT "TankerLog_operatorId_fkey"
FOREIGN KEY ("operatorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;