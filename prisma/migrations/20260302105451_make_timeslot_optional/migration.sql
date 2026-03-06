-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_timeSlotId_fkey";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "timeSlotId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "TimeSlot_serviceDate_idx" ON "TimeSlot"("serviceDate");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
