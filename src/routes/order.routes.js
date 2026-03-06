// src/routes/order.routes.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

/* =========================
   CLIENT
========================= */

// Récupérer le panier actuel
router.get("/cart", authMiddleware, orderController.getCart);

// Ajouter une pizza au panier
router.post("/cart", authMiddleware, orderController.addToCart);

// Supprimer un item du panier
router.delete("/cart/:itemId", authMiddleware, orderController.removeItem);

// Finaliser la commande
router.post("/finalize", authMiddleware, orderController.finalizeOrder);

/* =========================
   ADMIN
========================= */

// Récupérer toutes les commandes avec filtres : date, userId, status
// Exemple de query : /admin/orders?date=2026-03-02&status=COMPLETED&filterUserId=3
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  orderController.getOrdersAdmin
);

// Supprimer une commande par ID
router.delete(
  "/:orderId",
  authMiddleware,
  adminMiddleware,
  orderController.deleteOrderAdmin
);

// ===== NOUVEAU : Changer le status d'une commande =====
// PATCH /api/admin/orders/:orderId/status
router.patch(
  "/:orderId/status",
  authMiddleware,
  adminMiddleware,
  orderController.updateOrderStatusAdmin
);

module.exports = router;