-- AlterTable
ALTER TABLE "ManualTestResult" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parameterStatuses" JSONB;

-- CreateTable
CREATE TABLE "Pump" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "flowRate" DOUBLE PRECISION,
    "pressure" DOUBLE PRECISION,
    "runtimeHours" DOUBLE PRECISION,
    "tankId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTestThreshold" (
    "parameter" TEXT NOT NULL,
    "sensorType" "SensorType" NOT NULL,
    "goodMin" DOUBLE PRECISION NOT NULL,
    "goodMax" DOUBLE PRECISION NOT NULL,
    "warningMin" DOUBLE PRECISION NOT NULL,
    "warningMax" DOUBLE PRECISION NOT NULL,
    "criticalMin" DOUBLE PRECISION NOT NULL,
    "criticalMax" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTestThreshold_pkey" PRIMARY KEY ("parameter")
);

-- CreateIndex
CREATE INDEX "Pump_tankId_idx" ON "Pump"("tankId");

-- CreateIndex
CREATE UNIQUE INDEX "Pump_tankId_name_key" ON "Pump"("tankId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ManualTestThreshold_sensorType_key" ON "ManualTestThreshold"("sensorType");

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the confirmed manual-test ranges previously used by the Operator UI.
INSERT INTO "ManualTestThreshold"
  ("parameter", "sensorType", "goodMin", "goodMax", "warningMin", "warningMax", "criticalMin", "criticalMax", "unit", "updatedAt")
VALUES
  ('pH', 'PH', 6.5, 8.5, 6.0, 9.0, 0, 14, 'pH', CURRENT_TIMESTAMP),
  ('BOD', 'BOD', 0, 20, 20, 30, 30, 100, 'mg/L', CURRENT_TIMESTAMP),
  ('COD', 'COD', 0, 100, 100, 250, 250, 1000, 'mg/L', CURRENT_TIMESTAMP),
  ('DO', 'DISSOLVED_OXYGEN', 4, 10, 2, 4, 0, 2, 'mg/L', CURRENT_TIMESTAMP),
  ('TSS', 'TSS', 0, 30, 30, 50, 50, 500, 'mg/L', CURRENT_TIMESTAMP),
  ('Turbidity', 'TURBIDITY', 0, 5, 5, 10, 10, 100, 'NTU', CURRENT_TIMESTAMP),
  ('Temperature', 'TEMPERATURE', 20, 35, 15, 40, 0, 50, '°C', CURRENT_TIMESTAMP);
