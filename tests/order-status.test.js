const test = require("node:test");
const assert = require("node:assert/strict");
const { OrderStatus } = require("@prisma/client");

const {
  isSlotReservedStatus,
  assertAllowedTransition,
} = require("../src/utils/order-status");

test("VALIDATE is treated as a reserved slot status", () => {
  assert.equal(isSlotReservedStatus(OrderStatus.VALIDATE), true);
  assert.equal(isSlotReservedStatus(OrderStatus.PENDING), false);
});

test("FINALIZED can transition to VALIDATE", () => {
  assert.doesNotThrow(() =>
    assertAllowedTransition(OrderStatus.FINALIZED, OrderStatus.VALIDATE)
  );
});

test("VALIDATE cannot transition back to FINALIZED", () => {
  assert.throws(
    () => assertAllowedTransition(OrderStatus.VALIDATE, OrderStatus.FINALIZED),
    /Invalid status transition/
  );
});
