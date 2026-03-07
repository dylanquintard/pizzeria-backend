const { OrderStatus } = require("@prisma/client");

const SLOT_RESERVED_STATUSES = new Set([
  OrderStatus.COMPLETED,
  OrderStatus.FINALIZED,
]);

const ORDER_STATUS_TRANSITIONS = {
  [OrderStatus.PENDING]: new Set([OrderStatus.COMPLETED, OrderStatus.CANCELED]),
  [OrderStatus.COMPLETED]: new Set([OrderStatus.FINALIZED, OrderStatus.CANCELED]),
  [OrderStatus.FINALIZED]: new Set([OrderStatus.CANCELED]),
  [OrderStatus.CANCELED]: new Set(),
};

function isSlotReservedStatus(status) {
  return SLOT_RESERVED_STATUSES.has(status);
}

function assertAllowedTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;

  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(nextStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} -> ${nextStatus}`);
  }
}

module.exports = {
  isSlotReservedStatus,
  assertAllowedTransition,
};
