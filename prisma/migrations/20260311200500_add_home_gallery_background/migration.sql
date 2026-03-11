ALTER TABLE "HomeGalleryImage"
ADD COLUMN IF NOT EXISTS "isHomeBackground" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "HomeGalleryImage_active_isHomeBackground_sortOrder_idx"
ON "HomeGalleryImage"("active", "isHomeBackground", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "HomeGalleryImage_one_home_background_idx"
ON "HomeGalleryImage"("isHomeBackground")
WHERE "isHomeBackground" = true;