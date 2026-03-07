-- Backend2 optimizations

-- Keep only one pending cart per user
CREATE UNIQUE INDEX IF NOT EXISTS "Order_user_pending_unique"
ON "Order" ("userId")
WHERE "status" = 'PENDING';

-- Query optimization for admin/client order fetches
CREATE INDEX IF NOT EXISTS "Order_userId_status_createdAt_idx"
ON "Order" ("userId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx"
ON "Order" ("status", "createdAt");

-- Query optimization for active time slot lookup
CREATE INDEX IF NOT EXISTS "TimeSlot_active_startTime_idx"
ON "TimeSlot" ("active", "startTime");

-- Query optimization for order item joins
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_pizzaId_idx"
ON "OrderItem" ("orderId", "pizzaId");
