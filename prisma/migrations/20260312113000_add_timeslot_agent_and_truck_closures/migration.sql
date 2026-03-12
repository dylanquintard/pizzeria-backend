-- AlterTable
ALTER TABLE "TimeSlot"
ADD COLUMN "agentId" INTEGER;

-- CreateTable
CREATE TABLE "PrintAgentClosure" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintAgentClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeSlot_agentId_idx" ON "TimeSlot"("agentId");

-- CreateIndex
CREATE INDEX "TimeSlot_agentId_serviceDate_startTime_idx" ON "TimeSlot"("agentId", "serviceDate", "startTime");

-- CreateIndex
CREATE INDEX "PrintAgentClosure_agentId_startDate_endDate_idx" ON "PrintAgentClosure"("agentId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "TimeSlot"
ADD CONSTRAINT "TimeSlot_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintAgentClosure"
ADD CONSTRAINT "PrintAgentClosure_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck constraints
ALTER TABLE "PrintAgentClosure"
ADD CONSTRAINT "PrintAgentClosure_date_range_check" CHECK ("endDate" >= "startDate");
