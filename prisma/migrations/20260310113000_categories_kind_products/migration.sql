-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('PRODUCT', 'INGREDIENT');

-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "kind" "CategoryKind" NOT NULL DEFAULT 'PRODUCT';

-- Ensure category names are unique per kind
ALTER TABLE "Category"
DROP CONSTRAINT IF EXISTS "Category_name_key";

ALTER TABLE "Category"
ADD CONSTRAINT "Category_name_kind_key" UNIQUE ("name", "kind");

-- AlterTable
ALTER TABLE "Ingredient"
ADD COLUMN "categoryId" INTEGER;

-- CreateIndex
CREATE INDEX "Category_active_kind_sortOrder_idx" ON "Category"("active", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "Ingredient_categoryId_idx" ON "Ingredient"("categoryId");

-- AddForeignKey
ALTER TABLE "Ingredient"
ADD CONSTRAINT "Ingredient_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
