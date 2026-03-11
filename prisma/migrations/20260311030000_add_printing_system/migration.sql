-- CreateEnum
CREATE TYPE "PrintAgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED');

-- CreateEnum
CREATE TYPE "PrinterConnectionType" AS ENUM ('ETHERNET', 'USB');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'READY', 'CLAIMED', 'PRINTING', 'PRINTED', 'FAILED', 'RETRY_WAITING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('ORDER_TICKET');

-- CreateEnum
CREATE TYPE "PrintLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "customerNote" TEXT;

-- CreateTable
CREATE TABLE "PrintAgent" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "PrintAgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,
    "version" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "paperWidthMm" INTEGER NOT NULL DEFAULT 80,
    "connectionType" "PrinterConnectionType" NOT NULL DEFAULT 'ETHERNET',
    "ipAddress" TEXT,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "agentId" INTEGER,
    "locationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "printerId" INTEGER NOT NULL,
    "jobType" "PrintJobType" NOT NULL DEFAULT 'ORDER_TICKET',
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "nextRetryAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "claimedByAgentId" INTEGER,
    "claimToken" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "printedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "reprintOfJobId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJobAttempt" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "agentId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "success" BOOLEAN,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "printerResponse" JSONB,

    CONSTRAINT "PrintJobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintLog" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT,
    "agentId" INTEGER,
    "level" "PrintLogLevel" NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrintAgent_code_key" ON "PrintAgent"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Printer_code_key" ON "Printer"("code");

-- CreateIndex
CREATE INDEX "Printer_isActive_locationId_idx" ON "Printer"("isActive", "locationId");

-- CreateIndex
CREATE INDEX "Printer_agentId_idx" ON "Printer"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_idempotencyKey_key" ON "PrintJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PrintJob_status_scheduledAt_nextRetryAt_priority_createdAt_idx" ON "PrintJob"("status", "scheduledAt", "nextRetryAt", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "PrintJob_claimedByAgentId_status_lockedUntil_idx" ON "PrintJob"("claimedByAgentId", "status", "lockedUntil");

-- CreateIndex
CREATE INDEX "PrintJob_orderId_createdAt_idx" ON "PrintJob"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_orderId_printerId_jobType_primary_key" ON "PrintJob"("orderId", "printerId", "jobType") WHERE "reprintOfJobId" IS NULL;

-- CreateIndex
CREATE INDEX "PrintJobAttempt_jobId_startedAt_idx" ON "PrintJobAttempt"("jobId", "startedAt");

-- CreateIndex
CREATE INDEX "PrintLog_jobId_createdAt_idx" ON "PrintLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "PrintLog_agentId_createdAt_idx" ON "PrintLog"("agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Printer"
ADD CONSTRAINT "Printer_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Printer"
ADD CONSTRAINT "Printer_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_printerId_fkey"
FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_claimedByAgentId_fkey"
FOREIGN KEY ("claimedByAgentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_reprintOfJobId_fkey"
FOREIGN KEY ("reprintOfJobId") REFERENCES "PrintJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJobAttempt"
ADD CONSTRAINT "PrintJobAttempt_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "PrintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJobAttempt"
ADD CONSTRAINT "PrintJobAttempt_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintLog"
ADD CONSTRAINT "PrintLog_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "PrintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintLog"
ADD CONSTRAINT "PrintLog_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheck constraints
ALTER TABLE "Printer"
ADD CONSTRAINT "Printer_port_check" CHECK ("port" > 0 AND "port" < 65536);

ALTER TABLE "Printer"
ADD CONSTRAINT "Printer_paperWidthMm_check" CHECK ("paperWidthMm" IN (58, 80));

ALTER TABLE "Order"
ADD CONSTRAINT "Order_customerNote_length_check" CHECK ("customerNote" IS NULL OR char_length("customerNote") <= 1000);
