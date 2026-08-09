-- AlterTable
ALTER TABLE "Pump" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "capacity" DOUBLE PRECISION,
ADD COLUMN     "capacityUnit" TEXT DEFAULT 'm³/hr',
ADD COLUMN     "installedAt" TIMESTAMP(3),
ADD COLUMN     "modelNumber" TEXT,
ADD COLUMN     "powerKw" DOUBLE PRECISION,
ADD COLUMN     "warrantyExpiresAt" TIMESTAMP(3);
