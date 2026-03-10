-- Allow product deletion even when referenced by historical order items.
ALTER TABLE "OrderItem"
DROP CONSTRAINT IF EXISTS "OrderItem_pizzaId_fkey";

ALTER TABLE "OrderItem"
ALTER COLUMN "pizzaId" DROP NOT NULL;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_pizzaId_fkey"
FOREIGN KEY ("pizzaId") REFERENCES "Pizza"("id") ON DELETE SET NULL ON UPDATE CASCADE;
