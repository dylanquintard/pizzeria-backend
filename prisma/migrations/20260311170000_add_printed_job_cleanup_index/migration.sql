-- Supports fast cleanup of old printed jobs
CREATE INDEX "PrintJob_status_printedAt_idx" ON "PrintJob"("status", "printedAt");
