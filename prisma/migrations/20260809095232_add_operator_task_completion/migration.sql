-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completionNote" TEXT,
ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
