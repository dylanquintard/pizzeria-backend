CREATE TABLE "OrderReview" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderReview_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "OrderReview_orderId_key" ON "OrderReview"("orderId");
CREATE INDEX "OrderReview_userId_createdAt_idx" ON "OrderReview"("userId", "createdAt");
CREATE INDEX "OrderReview_createdAt_idx" ON "OrderReview"("createdAt");

ALTER TABLE "OrderReview"
ADD CONSTRAINT "OrderReview_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderReview"
ADD CONSTRAINT "OrderReview_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
