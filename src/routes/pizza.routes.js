const express = require("express");
const router = express.Router();
const pizzaController = require("../controllers/pizza.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth.js");

// --- Routes CLIENT ---
router.get("/", pizzaController.getAllPizzas);          // /api/pizzas
router.get("/:id/details", pizzaController.getPizzaById);
router.get("/ingredients", pizzaController.getAllIngredients); // /api/pizzas/ingredients

// --- Routes ADMIN ---
router.post("/", authMiddleware, adminMiddleware, pizzaController.createPizza); // POST /api/pizzas
router.put("/:id", authMiddleware, adminMiddleware, pizzaController.updatePizza);
router.delete("/:id", authMiddleware, adminMiddleware, pizzaController.deletePizza);

router.post("/ingredients", authMiddleware, adminMiddleware, pizzaController.createIngredient);
router.put("/ingredients/:id", authMiddleware, adminMiddleware, pizzaController.updateIngredient);
router.delete("/ingredients/:id", authMiddleware, adminMiddleware, pizzaController.deleteIngredient);

router.post("/pizzas/ingredients", authMiddleware, adminMiddleware, pizzaController.addIngredientToPizza);
router.delete("/pizzas/ingredients",authMiddleware,adminMiddleware,pizzaController.removeIngredientFromPizza);

module.exports = router;