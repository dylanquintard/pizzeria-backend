const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/", productController.getAllProducts);
router.get("/ingredients", productController.getAllIngredients);
router.get("/:id/details", productController.getProductById);

router.post("/", authMiddleware, adminMiddleware, productController.createProduct);
router.put("/:id", authMiddleware, adminMiddleware, productController.updateProduct);
router.delete("/:id", authMiddleware, adminMiddleware, productController.deleteProduct);

router.post(
  "/ingredients",
  authMiddleware,
  adminMiddleware,
  productController.createIngredient
);
router.put(
  "/ingredients/:id",
  authMiddleware,
  adminMiddleware,
  productController.updateIngredient
);

router.post(
  "/ingredients/link",
  authMiddleware,
  adminMiddleware,
  productController.addIngredientToProduct
);
router.delete(
  "/ingredients/link",
  authMiddleware,
  adminMiddleware,
  productController.removeIngredientFromProduct
);
router.delete(
  "/ingredients/:id",
  authMiddleware,
  adminMiddleware,
  productController.deleteIngredient
);

module.exports = router;
