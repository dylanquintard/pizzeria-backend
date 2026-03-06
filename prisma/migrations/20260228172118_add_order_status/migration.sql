/*
  Warnings:

  - Added the required column `serviceDate` to the `TimeSlot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "TimeSlot" ADD COLUMN "serviceDate" timestamp NOT NULL DEFAULT NOW();
