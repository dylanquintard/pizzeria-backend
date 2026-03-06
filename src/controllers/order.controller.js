// src/controllers/order.controller.js
const orderService = require("../services/order.service");

function getUserId(req) {
  return req.user?.userId || req.user?.id;
}

// ===== CLIENT =====
async function getCart(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

    const cart = await orderService.getCartByUserId(userId);
    res.json(cart);
  } catch (err) {
    console.error("getCart error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addToCart(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

    const { pizzaId, quantity, customizations } = req.body;

    const cart = await orderService.addToCart(userId, pizzaId, quantity, customizations);
    res.json(cart);
  } catch (err) {
    console.error("addToCart error:", err);
    res.status(400).json({ error: err.message });
  }
}

async function removeItem(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

    const cart = await orderService.removeItemFromCart(userId, req.params.itemId);
    res.json(cart);
  } catch (err) {
    console.error("removeItem error:", err);
    res.status(400).json({ error: err.message });
  }
}

async function finalizeOrder(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Utilisateur non authentifié" });

    const { timeSlotId } = req.body;

    const order = await orderService.finalizeOrder(userId, timeSlotId);

    const io = req.app.get("io");
    io.to("admins").emit("orderCompleted", order); // maintenant order.user existe

    res.json(order);
  } catch (err) {
    console.error("finalizeOrder error:", err);
    res.status(400).json({ error: err.message });
  }
}

// ===== ADMIN =====
async function getOrdersAdmin(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId || req.user.role !== "ADMIN") return res.status(401).json({ error: "Accès non autorisé" });

    const { date, status, filterUserId } = req.query;
    const filters = {};
    if (date) filters.date = date;
    if (status) filters.status = status;
    if (filterUserId) filters.userId = Number(filterUserId);

    const orders = await orderService.getOrdersAdmin(filters);
    res.json(orders);
  } catch (err) {
    console.error("getOrdersAdmin error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteOrderAdmin(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId || req.user.role !== "ADMIN") return res.status(401).json({ error: "Accès non autorisé" });

    const { orderId } = req.params;
    await orderService.deleteOrder(orderId);
    res.json({ success: true });
  } catch (err) {
    console.error("deleteOrderAdmin error:", err);
    res.status(400).json({ error: err.message });
  }
}


async function updateOrderStatusAdmin(req, res) {
  try {
    if (!req.user || req.user.role !== "ADMIN")
      return res.status(401).json({ error: "Accès non autorisé" });

    const { orderId } = req.params;
    const { status } = req.body;

    // --------------------------
    // Récupérer la commande par ID
    // --------------------------
    const order = await orderService.getOrderById(orderId); // On va créer cette fonction côté service
    if (!order) return res.status(404).json({ error: "Commande introuvable" });

    // --------------------------
    // Vérifie que la commande est COMPLETED avant de passer à FINALIZED
    // --------------------------
    if (status === "FINALIZED" && order.status !== "COMPLETED") {
      return res.status(400).json({
        error: "Seules les commandes COMPLETED peuvent être finalisées",
      });
    }

    // --------------------------
    // Mettre à jour le status via le service admin
    // --------------------------
    const updatedOrder = await orderService.updateOrderStatusAdmin(orderId, status);

    res.json(updatedOrder);
  } catch (err) {
    console.error("updateOrderStatusAdmin error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  // ===== CLIENT =====
  getCart,
  addToCart,
  removeItem,
  finalizeOrder,


  // ===== ADMIN =====
  getOrdersAdmin,
  deleteOrderAdmin,
  updateOrderStatusAdmin, // ← nouveau
};