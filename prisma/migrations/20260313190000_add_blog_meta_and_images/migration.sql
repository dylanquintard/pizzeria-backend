-- AlterTable
ALTER TABLE "BlogArticle"
ADD COLUMN "metaTitle" TEXT,
ADD COLUMN "metaDescription" TEXT;

-- CreateTable
CREATE TABLE "BlogImage" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogImage_articleId_sortOrder_idx"
ON "BlogImage"("articleId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BlogImage"
ADD CONSTRAINT "BlogImage_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
