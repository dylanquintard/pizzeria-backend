ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailOtpCode" TEXT,
ADD COLUMN "phoneOtpCode" TEXT,
ADD COLUMN "otpExpiresAt" TIMESTAMP(3);

UPDATE "User"
SET
  "emailVerified" = true,
  "phoneVerified" = true;
