const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/cart", authMiddleware, orderController.getCart);
router.post("/cart", authMiddleware, orderController.addToCart);
router.delete("/cart/:itemId", authMiddleware, orderController.removeItem);
router.post("/finalize", authMiddleware, orderController.finalizeOrder);

router.get("/", authMiddleware, adminMiddleware, orderController.getOrdersAdmin);
router.delete(
  "/:orderId",
  authMiddleware,
  adminMiddleware,
  orderController.deleteOrderAdmin
);
router.patch(
  "/:orderId/status",
  authMiddleware,
  adminMiddleware,
  orderController.updateOrderStatusAdmin
);

module.exports = router;
