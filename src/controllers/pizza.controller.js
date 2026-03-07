const pizzaService = require("../services/pizza.service");

async function getAllPizzas(req, res) {
  try {
    const pizzas = await pizzaService.getAllPizzas(req.query);
    res.json(pizzas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPizzaById(req, res) {
  try {
    const pizza = await pizzaService.getPizzaById(req.params.id);
    res.json(pizza);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function createPizza(req, res) {
  try {
    const pizza = await pizzaService.createPizza(req.body);
    res.status(201).json(pizza);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updatePizza(req, res) {
  try {
    const pizza = await pizzaService.updatePizza(req.params.id, req.body);
    res.json(pizza);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deletePizza(req, res) {
  try {
    await pizzaService.deletePizza(req.params.id);
    res.json({ message: "Pizza deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAllIngredients(_req, res) {
  try {
    const ingredients = await pizzaService.getAllIngredients();
    res.json(ingredients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createIngredient(req, res) {
  try {
    const ingredient = await pizzaService.createIngredient(req.body);
    res.status(201).json(ingredient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateIngredient(req, res) {
  try {
    const ingredient = await pizzaService.updateIngredient(req.params.id, req.body);
    res.json(ingredient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteIngredient(req, res) {
  try {
    await pizzaService.deleteIngredient(req.params.id);
    res.json({ message: "Ingredient deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addIngredientToPizza(req, res) {
  try {
    const { pizzaId, ingredientId } = req.body;
    const link = await pizzaService.addIngredientToPizza(pizzaId, ingredientId);
    res.status(201).json(link);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeIngredientFromPizza(req, res) {
  try {
    const { pizzaId, ingredientId } = req.body;
    await pizzaService.removeIngredientFromPizza(pizzaId, ingredientId);
    res.json({ message: "Ingredient removed from pizza" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getAllPizzas,
  getPizzaById,
  createPizza,
  updatePizza,
  deletePizza,
  getAllIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  addIngredientToPizza,
  removeIngredientFromPizza,
};
