const express = require("express");
const router = express.Router();
const pizzaController = require("../controllers/product.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/", pizzaController.getAllPizzas);
router.get("/ingredients", pizzaController.getAllIngredients);
router.get("/:id/details", pizzaController.getPizzaById);

router.post("/", authMiddleware, adminMiddleware, pizzaController.createPizza);
router.put("/:id", authMiddleware, adminMiddleware, pizzaController.updatePizza);
router.delete("/:id", authMiddleware, adminMiddleware, pizzaController.deletePizza);

router.post(
  "/ingredients",
  authMiddleware,
  adminMiddleware,
  pizzaController.createIngredient
);
router.put(
  "/ingredients/:id",
  authMiddleware,
  adminMiddleware,
  pizzaController.updateIngredient
);

router.post(
  "/ingredients/link",
  authMiddleware,
  adminMiddleware,
  pizzaController.addIngredientToPizza
);
router.delete(
  "/ingredients/link",
  authMiddleware,
  adminMiddleware,
  pizzaController.removeIngredientFromPizza
);
router.delete(
  "/ingredients/:id",
  authMiddleware,
  adminMiddleware,
  pizzaController.deleteIngredient
);

module.exports = router;
