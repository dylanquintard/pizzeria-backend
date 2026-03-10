const { OrderStatus } = require("@prisma/client");
const prisma = require("../lib/prisma");
const { normalizeCustomizations } = require("../utils/customizations");
const {
  isSlotReservedStatus,
  assertAllowedTransition,
} = require("../utils/order-status");

const ORDER_INCLUDE = {
  items: { include: { product: { include: { category: true } } } },
  timeSlot: { include: { location: true } },
  user: { select: { id: true, name: true } },
};

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!OrderStatus[normalized]) {
    throw new Error(`Invalid status: ${status}`);
  }
  return OrderStatus[normalized];
}

function getOrderProductsCount(order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

async function recalculateTotal(client, orderId) {
  const items = await client.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, unitPrice: true },
  });

  const total = items.reduce(
    (acc, item) => acc + Number(item.unitPrice) * item.quantity,
    0
  );

  await client.order.update({ where: { id: orderId }, data: { total } });
  return total;
}

async function buildIngredientMapFromOrders(orders) {
  const ingredientIds = new Set();

  for (const order of orders) {
    for (const item of order.items) {
      const custom = normalizeCustomizations(item.customizations || {});
      for (const id of custom.addedIngredients) ingredientIds.add(id);
      for (const id of custom.removedIngredients) ingredientIds.add(id);
    }
  }

  if (ingredientIds.size === 0) return new Map();

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: [...ingredientIds] } },
    select: { id: true, name: true, price: true },
  });

  return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
}

function formatOrderWithIngredientMap(order, ingredientMap) {
  if (!order) return { items: [] };

  const items = order.items.map((item) => {
    const custom = normalizeCustomizations(item.customizations || {});

    const addedIngredients = custom.addedIngredients
      .map((id) => ingredientMap.get(id))
      .filter(Boolean)
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        price: Number(ingredient.price),
      }));

    const removedIngredients = custom.removedIngredients
      .map((id) => ingredientMap.get(id))
      .filter(Boolean)
      .map((ingredient) => ({ id: ingredient.id, name: ingredient.name }));

    const productPayload = {
      id: item.product.id,
      name: item.product.name,
      basePrice: Number(item.product.basePrice),
      category: item.product.category
        ? { id: item.product.category.id, name: item.product.category.name }
        : null,
    };

    return {
      id: item.id,
      product: productPayload,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      addedIngredients,
      removedIngredients,
    };
  });

  return {
    id: order.id,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt,
    timeSlot: order.timeSlot || null,
    user: order.user ? { id: order.user.id, name: order.user.name } : null,
    items,
  };
}

async function formatSingleOrder(order) {
  if (!order) return { items: [] };
  const ingredientMap = await buildIngredientMapFromOrders([order]);
  return formatOrderWithIngredientMap(order, ingredientMap);
}

async function formatOrderCollection(orders) {
  if (!orders || orders.length === 0) return [];
  const ingredientMap = await buildIngredientMapFromOrders(orders);
  return orders.map((order) => formatOrderWithIngredientMap(order, ingredientMap));
}

async function findOrCreatePendingCart(tx, userId) {
  const existingCart = await tx.order.findFirst({
    where: { userId, status: OrderStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  if (existingCart) return existingCart;

  try {
    return await tx.order.create({
      data: {
        status: OrderStatus.PENDING,
        total: 0,
        userId,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      const cart = await tx.order.findFirst({
        where: { userId, status: OrderStatus.PENDING },
        orderBy: { createdAt: "desc" },
      });
      if (cart) return cart;
    }
    throw err;
  }
}

async function reserveSlotCapacity(
  tx,
  timeSlotId,
  productsToReserve,
  { enforceStartBuffer = false } = {}
) {
  const slot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });

  if (!slot || !slot.active) {
    throw new Error("Invalid time slot");
  }

  if (enforceStartBuffer) {
    const minStart = new Date(Date.now() + 15 * 60_000);
    if (new Date(slot.startTime) < minStart) {
      throw new Error("Selected time slot is too soon");
    }
  }

  if (slot.maxPizzas < productsToReserve) {
    throw new Error("Time slot full");
  }

  const result = await tx.timeSlot.updateMany({
    where: {
      id: timeSlotId,
      active: true,
      currentPizzas: {
        lte: slot.maxPizzas - productsToReserve,
      },
    },
    data: {
      currentPizzas: {
        increment: productsToReserve,
      },
    },
  });

  if (result.count !== 1) {
    throw new Error("Time slot full");
  }
}

async function releaseSlotCapacity(tx, timeSlotId, productsToRelease) {
  const slot = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
  if (!slot) return;

  const nextCount = Math.max(0, slot.currentPizzas - productsToRelease);
  await tx.timeSlot.update({
    where: { id: timeSlotId },
    data: { currentPizzas: nextCount },
  });
}

async function getCartByUserId(userId) {
  const parsedUserId = parsePositiveInt(userId, "userId");

  const cart = await prisma.order.findFirst({
    where: { userId: parsedUserId, status: OrderStatus.PENDING },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return formatSingleOrder(cart);
}

async function addToCart(userId, productId, quantity, customizations = {}) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const parsedProductId = parsePositiveInt(productId, "productId");
  const parsedQuantity = parsePositiveInt(quantity, "quantity");
  const normalizedCustomizations = normalizeCustomizations(customizations);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: parsedProductId } });
    if (!product) throw new Error("Product not found");

    const cart = await findOrCreatePendingCart(tx, parsedUserId);

    let extrasTotal = 0;
    if (normalizedCustomizations.addedIngredients.length > 0) {
      const extras = await tx.ingredient.findMany({
        where: {
          id: { in: normalizedCustomizations.addedIngredients },
          isExtra: true,
        },
      });

      if (extras.length !== normalizedCustomizations.addedIngredients.length) {
        throw new Error("Invalid extra ingredient");
      }

      extrasTotal = extras.reduce((sum, ingredient) => sum + Number(ingredient.price), 0);
    }

    const unitPrice = Number(product.basePrice) + extrasTotal;

    const existingItem = await tx.orderItem.findFirst({
      where: {
        orderId: cart.id,
        productId: parsedProductId,
        customizations: {
          equals: normalizedCustomizations,
        },
      },
    });

    if (existingItem) {
      await tx.orderItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + parsedQuantity },
      });
    } else {
      await tx.orderItem.create({
        data: {
          orderId: cart.id,
          productId: parsedProductId,
          quantity: parsedQuantity,
          unitPrice,
          customizations: normalizedCustomizations,
        },
      });
    }

    await recalculateTotal(tx, cart.id);

    return tx.order.findUnique({
      where: { id: cart.id },
      include: ORDER_INCLUDE,
    });
  });

  return formatSingleOrder(updatedOrder);
}

async function removeItemFromCart(userId, itemId) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const parsedItemId = parsePositiveInt(itemId, "itemId");

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const cart = await tx.order.findFirst({
      where: { userId: parsedUserId, status: OrderStatus.PENDING },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    if (!cart) throw new Error("Cart not found");

    const item = cart.items.find((entry) => entry.id === parsedItemId);
    if (!item) throw new Error("Item not found");

    await tx.orderItem.delete({ where: { id: parsedItemId } });
    await recalculateTotal(tx, cart.id);

    return tx.order.findUnique({
      where: { id: cart.id },
      include: ORDER_INCLUDE,
    });
  });

  return formatSingleOrder(updatedOrder);
}

async function finalizeOrder(userId, timeSlotId) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const parsedTimeSlotId = parsePositiveInt(timeSlotId, "timeSlotId");

  const finalizedOrder = await prisma.$transaction(async (tx) => {
    const cart = await tx.order.findFirst({
      where: { userId: parsedUserId, status: OrderStatus.PENDING },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    const totalProducts = getOrderProductsCount(cart);

    await reserveSlotCapacity(tx, parsedTimeSlotId, totalProducts, {
      enforceStartBuffer: true,
    });

    await tx.order.update({
      where: { id: cart.id },
      data: {
        status: OrderStatus.COMPLETED,
        timeSlotId: parsedTimeSlotId,
      },
    });

    return tx.order.findUnique({
      where: { id: cart.id },
      include: ORDER_INCLUDE,
    });
  });

  return formatSingleOrder(finalizedOrder);
}

async function getOrdersAdmin(filters = {}) {
  const where = {};

  if (filters.userId) {
    where.userId = parsePositiveInt(filters.userId, "userId");
  }

  if (filters.status) {
    where.status = parseStatus(filters.status);
  }

  if (filters.date) {
    const startOfDay = new Date(filters.date);
    if (Number.isNaN(startOfDay.getTime())) {
      throw new Error("Invalid date");
    }
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    where.createdAt = { gte: startOfDay, lte: endOfDay };
  }

  const orders = await prisma.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });

  return formatOrderCollection(orders);
}

async function getOrderById(orderId) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId },
    include: ORDER_INCLUDE,
  });

  if (!order) return null;
  return formatSingleOrder(order);
}

async function deleteOrder(orderId) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: parsedOrderId },
      include: { items: true },
    });

    if (!order) throw new Error("Order not found");

    const productsCount = getOrderProductsCount(order);

    if (order.timeSlotId && isSlotReservedStatus(order.status)) {
      await releaseSlotCapacity(tx, order.timeSlotId, productsCount);
    }

    await tx.orderItem.deleteMany({ where: { orderId: parsedOrderId } });
    await tx.order.delete({ where: { id: parsedOrderId } });
  });

  return true;
}

async function updateOrderStatusAdmin(orderId, status) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");
  const nextStatus = parseStatus(status);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: parsedOrderId },
      include: { items: true, timeSlot: true, user: { select: { id: true, name: true } } },
    });

    if (!order) throw new Error("Order not found");

    assertAllowedTransition(order.status, nextStatus);

    if (order.status === nextStatus) {
      return tx.order.findUnique({ where: { id: parsedOrderId }, include: ORDER_INCLUDE });
    }

    const productsCount = getOrderProductsCount(order);
    const wasReserved = isSlotReservedStatus(order.status);
    const willReserve = isSlotReservedStatus(nextStatus);

    if (willReserve && !order.timeSlotId) {
      throw new Error("Order has no timeslot to reserve");
    }

    if (!wasReserved && willReserve) {
      await reserveSlotCapacity(tx, order.timeSlotId, productsCount);
    }

    if (wasReserved && !willReserve) {
      await releaseSlotCapacity(tx, order.timeSlotId, productsCount);
    }

    await tx.order.update({
      where: { id: parsedOrderId },
      data: { status: nextStatus },
    });

    return tx.order.findUnique({ where: { id: parsedOrderId }, include: ORDER_INCLUDE });
  });

  return formatSingleOrder(updatedOrder);
}

module.exports = {
  getCartByUserId,
  addToCart,
  removeItemFromCart,
  finalizeOrder,
  getOrdersAdmin,
  getOrderById,
  updateOrderStatusAdmin,
  deleteOrder,
};
