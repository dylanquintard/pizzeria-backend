// src/services/order.service.js
const { PrismaClient, OrderStatus } = require("@prisma/client");
const prisma = new PrismaClient();

/* =====================================================
   ENUM UTILS
===================================================== */
const ORDER_STATUS = {
  PENDING: OrderStatus.PENDING,
  FINALIZED: OrderStatus.FINALIZED,
  COMPLETED: OrderStatus.COMPLETED,
  CANCELED: OrderStatus.CANCELED,
};

/* =====================================================
   UTILS
===================================================== */
// Recalculer le total du panier
async function recalculateTotal(orderId) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const total = items.reduce((acc, item) => acc + Number(item.unitPrice) * item.quantity, 0);

  await prisma.order.update({ where: { id: orderId }, data: { total } });
  return total;
}

// Formatter le panier pour le frontend (avec objets complets pour ingrédients)
async function formatCart(order) {
  if (!order) return { items: [] };

  const formattedItems = await Promise.all(
    order.items.map(async (item) => {
      const custom = item.customizations || {};
      const addedIds = custom.addedIngredients || [];
      const removedIds = custom.removedIngredients || [];

      const addedIngredients =
        addedIds.length > 0
          ? await prisma.ingredient.findMany({
              where: { id: { in: addedIds } },
              select: { id: true, name: true, price: true },
            })
          : [];

      const removedIngredients =
        removedIds.length > 0
          ? await prisma.ingredient.findMany({
              where: { id: { in: removedIds } },
              select: { id: true, name: true },
            })
          : [];

      return {
        id: item.id,
        pizza: {
          id: item.pizza.id,
          name: item.pizza.name,
          basePrice: Number(item.pizza.basePrice),
        },
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        addedIngredients,
        removedIngredients,
      };
    })
  );

  return {
    id: order.id,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt,
    timeSlot: order.timeSlot || null,
    user: order.user ? { id: order.user.id, name: order.user.name } : null,
    items: formattedItems,
  };
}

/* =====================================================
   CLIENT
===================================================== */
async function getCartByUserId(userId) {
  userId = Number(userId);
  const cart = await prisma.order.findFirst({
    where: { userId, status: ORDER_STATUS.PENDING },
    include: { items: { include: { pizza: true } }, timeSlot: true },
    orderBy: { createdAt: "asc" },
  });
  return formatCart(cart);
}

async function addToCart(userId, pizzaId, quantity, customizations = {}) {
  userId = Number(userId);
  pizzaId = Number(pizzaId);
  quantity = Number(quantity);

  if (!Number.isInteger(userId) || !Number.isInteger(pizzaId) || quantity <= 0)
    throw new Error("Données invalides");

  const { addedIngredients = [], removedIngredients = [] } = customizations;

  const addedIds = [...new Set(addedIngredients.map(Number))].filter(Boolean);
  const removedIds = [...new Set(removedIngredients.map(Number))].filter(Boolean);

  const pizza = await prisma.pizza.findUnique({
    where: { id: pizzaId },
    include: { ingredients: true },
  });
  if (!pizza) throw new Error("Pizza introuvable");

  let cart = await prisma.order.findFirst({ where: { userId, status: ORDER_STATUS.PENDING } });
  if (!cart) {
    cart = await prisma.order.create({
      data: {
        status: ORDER_STATUS.PENDING,
        total: 0,
        user: { connect: { id: userId } },
      },
    });
  }

  let extrasTotal = 0;
  if (addedIds.length > 0) {
    const extras = await prisma.ingredient.findMany({
      where: { id: { in: addedIds }, isExtra: true },
    });
    if (extras.length !== addedIds.length) throw new Error("Supplément invalide");
    extrasTotal = extras.reduce((sum, ing) => sum + Number(ing.price), 0);
  }

  const unitPrice = Number(pizza.basePrice) + extrasTotal;

// Cherche si un item identique existe déjà dans le panier
const existingItem = await prisma.orderItem.findFirst({
  where: {
    orderId: cart.id,
    pizzaId,
    customizations: {
      equals: { addedIngredients: addedIds, removedIngredients: removedIds },
    },
  },
});

if (existingItem) {
  // Si oui, on incrémente la quantité
  await prisma.orderItem.update({
    where: { id: existingItem.id },
    data: { quantity: existingItem.quantity + quantity },
  });
} else {
  // Sinon, on crée un nouvel item
  await prisma.orderItem.create({
    data: {
      orderId: cart.id,
      pizzaId,
      quantity,
      unitPrice,
      customizations: { addedIngredients: addedIds, removedIngredients: removedIds },
    },
  });
}

  await recalculateTotal(cart.id);

  const updated = await prisma.order.findUnique({
    where: { id: cart.id },
    include: { items: { include: { pizza: true } }, timeSlot: true },
  });

  return formatCart(updated);
}

async function removeItemFromCart(userId, itemId) {
  userId = Number(userId);
  itemId = Number(itemId);

  const cart = await prisma.order.findFirst({
    where: { userId, status: ORDER_STATUS.PENDING },
    include: { items: true },
  });
  if (!cart) throw new Error("Panier introuvable");

  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Item introuvable");

  await prisma.orderItem.delete({ where: { id: itemId } });
  await recalculateTotal(cart.id);

  const updated = await prisma.order.findUnique({
    where: { id: cart.id },
    include: { items: { include: { pizza: true } }, timeSlot: true },
  });
  return formatCart(updated);
}

async function finalizeOrder(userId, timeSlotId) {
  userId = Number(userId);
  timeSlotId = Number(timeSlotId);

  const cart = await prisma.order.findFirst({
    where: { userId, status: OrderStatus.PENDING },
    include: { items: true },
  });
  if (!cart || cart.items.length === 0) throw new Error("Panier vide");

  const totalPizzas = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const slot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId } });
  if (!slot || !slot.active) throw new Error("Créneau invalide");
  if (slot.currentPizzas + totalPizzas > slot.maxPizzas) throw new Error("Créneau complet");

  await prisma.$transaction([
    prisma.order.update({
      where: { id: cart.id },
      data: { status: OrderStatus.COMPLETED, timeSlot: { connect: { id: timeSlotId } } },
    }),
    prisma.timeSlot.update({
      where: { id: timeSlotId },
      data: { currentPizzas: { increment: totalPizzas } },
    }),
  ]);

const finalized = await prisma.order.findUnique({
  where: { id: cart.id },
  include: {
    items: { include: { pizza: true } },
    timeSlot: true,
    user: { select: { id: true, name: true } }, // ← ajouté
  },
});

return formatCart(finalized);

  return formatCart(finalized);
}

/* =====================================================
   ADMIN FUNCTIONS
===================================================== */

// Récupérer toutes les commandes pour une date donnée avec filtres
async function getOrdersAdmin(filters = {}) {
  const { userId, status, date } = filters;
  const where = {};

  if (userId) where.userId = Number(userId);
  if (status) {
    const normalizedStatus = status.trim().toUpperCase();
    if (!OrderStatus[normalizedStatus]) throw new Error(`Statut invalide : ${status}`);
    where.status = OrderStatus[normalizedStatus];
  }
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    where.createdAt = { gte: startOfDay, lte: endOfDay };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      items: { include: { pizza: true } },
      timeSlot: true,
    },
    orderBy: [
      { timeSlot: { startTime: "asc" } },
      { createdAt: "asc" },
    ],
  });

  return Promise.all(orders.map(formatCart));
}

// Récupérer une commande par ID (nouveau)
async function getOrderById(orderId) {
  orderId = Number(orderId);
  if (!orderId) throw new Error("orderId manquant");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { pizza: true } }, timeSlot: true, user: true },
  });

  return formatCart(order);
}

// Supprimer une commande
async function deleteOrder(orderId) {
  orderId = Number(orderId);
  if (!orderId) throw new Error("orderId manquant");

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error("Commande introuvable");

  const totalPizzas = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const actions = [
    prisma.orderItem.deleteMany({ where: { orderId } }),
    prisma.order.delete({ where: { id: orderId } }),
  ];

  if (order.status === OrderStatus.COMPLETED && order.timeSlotId) {
    actions.push(prisma.timeSlot.update({
      where: { id: order.timeSlotId },
      data: { currentPizzas: { decrement: totalPizzas } },
    }));
  }

  await prisma.$transaction(actions);
  return true;
}

// Changer le status d'une commande
async function updateOrderStatusAdmin(orderId, status) {
  orderId = Number(orderId);
  if (!orderId) throw new Error("orderId manquant");
  if (!status) throw new Error("status manquant");

  const normalizedStatus = status.trim().toUpperCase();
  if (!OrderStatus[normalizedStatus]) throw new Error(`Statut invalide : ${status}`);

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus[normalizedStatus] },
    include: { items: { include: { pizza: true } }, timeSlot: true, user: true },
  });

  return formatCart(updatedOrder);
}

module.exports = {
  // ==================== CLIENT ====================
  getCartByUserId,
  addToCart,
  removeItemFromCart,
  finalizeOrder,

  // ==================== ADMIN =====================
  getOrdersAdmin,
  getOrderById,            // ← ajouté
  updateOrderStatusAdmin,
  deleteOrder,
};