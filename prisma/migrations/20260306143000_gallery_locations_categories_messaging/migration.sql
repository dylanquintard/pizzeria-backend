DO $$
BEGIN
  CREATE TYPE "MessageThreadStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "MessageSender" AS ENUM ('CLIENT', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE "Category" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_active_sortOrder_idx" ON "Category"("active", "sortOrder");

ALTER TABLE "Pizza"
ADD COLUMN "categoryId" INTEGER;

CREATE INDEX "Pizza_categoryId_idx" ON "Pizza"("categoryId");

ALTER TABLE "Pizza"
ADD CONSTRAINT "Pizza_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "Location" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'France',
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Location_active_name_idx" ON "Location"("active", "name");

ALTER TABLE "TimeSlot"
ADD COLUMN "locationId" INTEGER;

CREATE INDEX "TimeSlot_locationId_idx" ON "TimeSlot"("locationId");
CREATE INDEX "TimeSlot_locationId_serviceDate_startTime_idx"
ON "TimeSlot"("locationId", "serviceDate", "startTime");

ALTER TABLE "TimeSlot"
ADD CONSTRAINT "TimeSlot_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "HomeGalleryImage" (
  "id" SERIAL NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "imageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "altText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeGalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeGalleryImage_active_sortOrder_idx"
ON "HomeGalleryImage"("active", "sortOrder");

CREATE TABLE "MessageThread" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER,
  "subject" TEXT,
  "status" "MessageThreadStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageThread_userId_status_idx"
ON "MessageThread"("userId", "status");
CREATE INDEX "MessageThread_status_lastMessageAt_idx"
ON "MessageThread"("status", "lastMessageAt");

ALTER TABLE "MessageThread"
ADD CONSTRAINT "MessageThread_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "Message" (
  "id" SERIAL NOT NULL,
  "threadId" INTEGER NOT NULL,
  "sender" "MessageSender" NOT NULL,
  "senderUserId" INTEGER,
  "content" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_threadId_createdAt_idx"
ON "Message"("threadId", "createdAt");
CREATE INDEX "Message_senderUserId_idx"
ON "Message"("senderUserId");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

INSERT INTO "Category" ("name", "description", "sortOrder", "active")
VALUES
  ('Pizza', 'Plats salés', 0, true),
  ('Desserts', 'Plats sucrés', 1, true)
ON CONFLICT ("name") DO NOTHING;
