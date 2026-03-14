const { OrderStatus, PrintJobStatus } = require("@prisma/client");
const prisma = require("../lib/prisma");
const { normalizeCustomizations } = require("../utils/customizations");
const { DELETED_PRODUCT_FALLBACK_NAME } = require("../utils/product");
const {
  isSlotReservedStatus,
  assertAllowedTransition,
} = require("../utils/order-status");
const timeSlotService = require("./timeslot.service");
const printService = require("./print.service");

const ORDER_INCLUDE = {
  items: { include: { product: { include: { category: true } } } },
  timeSlot: { include: { location: true } },
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  activities: {
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  },
};

const ADMIN_ORDER_INCLUDE = {
  ...ORDER_INCLUDE,
  printJobs: {
    where: { reprintOfJobId: null },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true,
      reprintOfJobId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
};
function parseDeletedProductSnapshot(customizations) {
  const snapshot = customizations?.deletedProductSnapshot;
  if (!snapshot || typeof snapshot !== "object") return null;

  const expiresAt = new Date(snapshot.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return null;
  if (expiresAt <= new Date()) return null;

  return snapshot;
}

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

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function appendAndClause(where, clause) {
  if (!where.AND) {
    where.AND = [];
  }
  where.AND.push(clause);
}

function applyAdminStatusFilter(where, status) {
  const normalized = normalizeStatus(status);

  if (!normalized) return;

  if (normalized === "IN_PROGRESS") {
    appendAndClause(where, {
      status: {
        in: [OrderStatus.COMPLETED],
      },
    });
    appendAndClause(where, {
      NOT: {
        printJobs: {
          some: {
            reprintOfJobId: null,
            status: PrintJobStatus.PRINTED,
          },
        },
      },
    });
    return;
  }

  if (normalized === "PRINTED") {
    appendAndClause(where, {
      OR: [
        { status: OrderStatus.FINALIZED },
        { status: OrderStatus.VALIDATE },
        {
          printJobs: {
            some: {
              reprintOfJobId: null,
              status: PrintJobStatus.PRINTED,
            },
          },
        },
      ],
    });
    return;
  }

  where.status = parseStatus(normalized);
}

function deriveOrderWorkflowStatus(order, primaryPrintJob) {
  if (order?.status === OrderStatus.CANCELED) {
    return "CANCELED";
  }

  if (order?.status === OrderStatus.VALIDATE) {
    return "VALIDATED";
  }

  if (
    order?.status === OrderStatus.FINALIZED ||
    primaryPrintJob?.status === PrintJobStatus.PRINTED
  ) {
    return "PRINTED";
  }

  if (order?.status === OrderStatus.PENDING) {
    return "PENDING";
  }

  return "IN_PROGRESS";
}

function parseOptionalCustomerNote(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > 1000) {
    throw new Error("customerNote is too long");
  }
  return normalized;
}

function getOrderProductsCount(order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function formatPickupAddress(location) {
  if (!location) return "";
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [location.addressLine1, cityLine].filter(Boolean).join(", ");
}

function formatPickupTimeForEmail(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}h${minutes}`;
}

function getSiteNameFromSettingsRecord(record) {
  return String(record?.siteName || "").trim() || "Camion Pizza Italienne";
}

function getHeaderLogoUrlFromSettingsRecord(record) {
  return String(record?.seo?.headerLogoUrl || "").trim() || "";
}

function getActivityLabel(action) {
  switch (String(action || "").toUpperCase()) {
    case "ORDER_RECEIVED":
      return "Commande recue";
    case "ORDER_FINALIZED":
      return "Commande terminee";
    case "ORDER_VALIDATED":
      return "Commande validee";
    case "ORDER_CANCELED":
      return "Commande annulee";
    default:
      return "Action commande";
  }
}

function getActivityActorLabel(activity, orderUserId) {
  if (!activity?.actor) return null;
  if (activity.actor.id === orderUserId) {
    return "Client";
  }

  return (
    activity.actor.firstName ||
    activity.actor.name ||
    activity.actor.email ||
    `Utilisateur #${activity.actor.id}`
  );
}

async function createOrderActivity(tx, { orderId, actorUserId = null, action, metadata = null }) {
  if (!orderId || !action) return null;

  return tx.orderActivity.create({
    data: {
      orderId,
      actorUserId,
      action,
      metadata: metadata || undefined,
    },
  });
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
  const primaryPrintJob = Array.isArray(order.printJobs) && order.printJobs.length > 0
    ? order.printJobs[0]
    : null;
  const workflowStatus = deriveOrderWorkflowStatus(order, primaryPrintJob);

  const items = order.items.map((item) => {
    const rawCustomizations = item.customizations || {};
    const custom = normalizeCustomizations(rawCustomizations);
    const deletedSnapshot = parseDeletedProductSnapshot(rawCustomizations);

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

    const productPayload = item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          basePrice: Number(item.product.basePrice),
          category: item.product.category
            ? { id: item.product.category.id, name: item.product.category.name }
            : null,
        }
      : {
          id: null,
          name: deletedSnapshot?.name || DELETED_PRODUCT_FALLBACK_NAME,
          basePrice:
            deletedSnapshot?.basePrice !== undefined
              ? Number(deletedSnapshot.basePrice)
              : Number(item.unitPrice),
          category: deletedSnapshot?.categoryName
            ? { id: null, name: deletedSnapshot.categoryName }
            : null,
          archived: true,
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
    workflowStatus,
    printTicketStatus: primaryPrintJob?.status || null,
    primaryPrintJob: primaryPrintJob
      ? {
          id: primaryPrintJob.id,
          status: primaryPrintJob.status,
          scheduledAt: primaryPrintJob.scheduledAt,
          createdAt: primaryPrintJob.createdAt,
          updatedAt: primaryPrintJob.updatedAt,
        }
      : null,
    total: Number(order.total),
    customerNote: order.customerNote || null,
    note: order.customerNote || null,
    createdAt: order.createdAt,
    timeSlot: order.timeSlot || null,
    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
          firstName: order.user.firstName ?? null,
          lastName: order.user.lastName ?? null,
          phone: order.user.phone ?? null,
          email: order.user.email ?? null,
        }
      : null,
    activities: Array.isArray(order.activities)
      ? order.activities.map((activity) => ({
          id: activity.id,
          action: activity.action,
          label: getActivityLabel(activity.action),
          createdAt: activity.createdAt,
          actorLabel: getActivityActorLabel(activity, order.user?.id),
          actor: activity.actor
            ? {
                id: activity.actor.id,
                name: activity.actor.name ?? null,
                firstName: activity.actor.firstName ?? null,
                lastName: activity.actor.lastName ?? null,
                email: activity.actor.email ?? null,
              }
            : null,
        }))
      : [],
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
    const minStart = new Date(Date.now() + 30 * 60_000);
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

async function finalizeOrder(userId, pickupSelection = {}) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const pickupDate = pickupSelection?.pickupDate;
  const pickupTime = pickupSelection?.pickupTime;
  const locationId = pickupSelection?.locationId;
  const customerNote = parseOptionalCustomerNote(
    pickupSelection?.customerNote ?? pickupSelection?.note
  );

  if (!pickupDate) throw new Error("pickupDate is required");
  if (!pickupTime) throw new Error("pickupTime is required");
  if (locationId === undefined || locationId === null || locationId === "") {
    throw new Error("locationId is required");
  }

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
    const concreteSlot = await timeSlotService.findOrCreateConcreteSlotForPickup(tx, {
      pickupDate,
      pickupTime,
      locationId,
    });

    await reserveSlotCapacity(tx, concreteSlot.id, totalProducts, {
      enforceStartBuffer: true,
    });

    await tx.order.update({
      where: { id: cart.id },
      data: {
        status: OrderStatus.COMPLETED,
        timeSlotId: concreteSlot.id,
        customerNote,
      },
    });

    await createOrderActivity(tx, {
      orderId: cart.id,
      actorUserId: parsedUserId,
      action: "ORDER_RECEIVED",
      metadata: {
        status: OrderStatus.COMPLETED,
        timeSlotId: concreteSlot.id,
      },
    });

    try {
      await printService.enqueueOrderTicketForOrderId(tx, cart.id);
    } catch (printErr) {
      // Keep order finalization successful even if print infrastructure is not ready.
      console.error("enqueueOrderTicketForOrderId warning:", printErr?.message || printErr);
    }

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

  applyAdminStatusFilter(where, filters.status);

  if (filters.date) {
    const startOfDay = new Date(filters.date);
    if (Number.isNaN(startOfDay.getTime())) {
      throw new Error("Invalid date");
    }
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    where.timeSlot = {
      is: {
        startTime: { gte: startOfDay, lte: endOfDay },
      },
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: ADMIN_ORDER_INCLUDE,
    orderBy: [{ timeSlot: { startTime: "asc" } }, { createdAt: "desc" }],
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

async function updateOrderStatusAdmin(orderId, status, actorUserId = null) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");
  const nextStatus = parseStatus(status);
  const parsedActorUserId =
    actorUserId === undefined || actorUserId === null
      ? null
      : parsePositiveInt(actorUserId, "actorUserId");

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: parsedOrderId },
      include: {
        items: true,
        timeSlot: true,
        user: { select: { id: true, name: true, firstName: true, lastName: true, phone: true, email: true } },
      },
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

    const activityAction =
      nextStatus === OrderStatus.FINALIZED
        ? "ORDER_FINALIZED"
        : nextStatus === OrderStatus.VALIDATE
          ? "ORDER_VALIDATED"
          : nextStatus === OrderStatus.CANCELED
            ? "ORDER_CANCELED"
            : null;

    if (activityAction) {
      await createOrderActivity(tx, {
        orderId: parsedOrderId,
        actorUserId: parsedActorUserId,
        action: activityAction,
        metadata: {
          fromStatus: order.status,
          toStatus: nextStatus,
        },
      });
    }

    return tx.order.findUnique({ where: { id: parsedOrderId }, include: ORDER_INCLUDE });
  });

  return formatSingleOrder(updatedOrder);
}

async function getOrderConfirmationEmailData(orderId) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId },
    include: {
      user: { select: { email: true, name: true, firstName: true, lastName: true } },
      timeSlot: { include: { location: true } },
    },
  });

  if (!order) return null;

  return {
    orderId: order.id,
    toEmail: order.user?.email || null,
    customerName: order.user?.name || "",
    customerFirstName: order.user?.firstName || null,
    customerLastName: order.user?.lastName || null,
    customerNote: order.customerNote || null,
    pickupTimeLabel: order.timeSlot?.startTime
      ? formatPickupTimeForEmail(order.timeSlot.startTime)
      : "",
    pickupLocationName: order.timeSlot?.location?.name || "",
    pickupAddress: formatPickupAddress(order.timeSlot?.location),
  };
}

async function getOrderValidationEmailData(orderId) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");

  const [order, siteSettings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: parsedOrderId },
      include: {
        user: { select: { email: true, name: true, firstName: true, lastName: true } },
      },
    }),
    prisma.siteSetting.findUnique({
      where: { id: 1 },
      select: {
        siteName: true,
        seo: true,
      },
    }),
  ]);

  if (!order) return null;

  return {
    orderId: order.id,
    toEmail: order.user?.email || null,
    customerName:
      order.user?.firstName ||
      order.user?.name ||
      "client",
    siteName: getSiteNameFromSettingsRecord(siteSettings),
    headerLogoUrl: getHeaderLogoUrlFromSettingsRecord(siteSettings),
  };
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
  getOrderConfirmationEmailData,
  getOrderValidationEmailData,
};
