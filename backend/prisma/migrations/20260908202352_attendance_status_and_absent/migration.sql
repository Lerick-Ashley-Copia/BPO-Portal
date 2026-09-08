-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "markedBy" TEXT,
ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'present',
ALTER COLUMN "checkInAt" DROP NOT NULL;
