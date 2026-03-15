-- Add explicit category-level control for customer customization in ordering.
ALTER TABLE "Category"
ADD COLUMN "customerCanCustomize" BOOLEAN NOT NULL DEFAULT false;

-- Preserve current behavior for pizza-like product categories.
UPDATE "Category"
SET "customerCanCustomize" = true
WHERE "kind" = 'PRODUCT'
  AND (
    LOWER("name") LIKE '%pizza%'
    OR LOWER(COALESCE("description", '')) LIKE '%pizza%'
  );
