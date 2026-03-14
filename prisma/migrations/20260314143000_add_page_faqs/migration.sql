CREATE TABLE "PageFaq" (
    "id" SERIAL NOT NULL,
    "targetPath" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageFaq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageFaq_targetPath_active_sortOrder_idx" ON "PageFaq"("targetPath", "active", "sortOrder");
CREATE INDEX "PageFaq_targetPath_sortOrder_idx" ON "PageFaq"("targetPath", "sortOrder");
