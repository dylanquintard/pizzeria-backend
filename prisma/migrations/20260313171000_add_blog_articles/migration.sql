-- CreateTable
CREATE TABLE "BlogArticle" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogParagraph" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogParagraph_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogArticle_slug_key" ON "BlogArticle"("slug");

-- CreateIndex
CREATE INDEX "BlogArticle_published_publishedAt_updatedAt_idx"
ON "BlogArticle"("published", "publishedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BlogParagraph_articleId_sortOrder_idx"
ON "BlogParagraph"("articleId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BlogParagraph"
ADD CONSTRAINT "BlogParagraph_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
