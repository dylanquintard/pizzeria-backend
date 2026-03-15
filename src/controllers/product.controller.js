const productService = require("../services/product.service");

async function getAllProducts(req, res) {
  try {
    const products = await productService.getAllProducts(req.query);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getProductById(req, res) {
  try {
    const product = await productService.getProductById(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function createProduct(req, res) {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateProduct(req, res) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteProduct(req, res) {
  try {
    await productService.deleteProduct(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAllIngredients(req, res) {
  try {
    const ingredients = await productService.getAllIngredients(req.query || {});
    res.json(ingredients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createIngredient(req, res) {
  try {
    const ingredient = await productService.createIngredient(req.body);
    res.status(201).json(ingredient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateIngredient(req, res) {
  try {
    const ingredient = await productService.updateIngredient(req.params.id, req.body);
    res.json(ingredient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteIngredient(req, res) {
  try {
    await productService.deleteIngredient(req.params.id);
    res.json({ message: "Ingredient deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addIngredientToProduct(req, res) {
  try {
    const { productId, ingredientId, isBase } = req.body || {};
    const link = await productService.addIngredientToProduct(productId, ingredientId, {
      isBase,
    });
    res.status(201).json(link);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateIngredientLinkOnProduct(req, res) {
  try {
    const { productId, ingredientId, isBase } = req.body || {};
    const link = await productService.updateIngredientLinkOnProduct(productId, ingredientId, {
      isBase,
    });
    res.json(link);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeIngredientFromProduct(req, res) {
  try {
    const { productId, ingredientId } = req.body || {};
    await productService.removeIngredientFromProduct(productId, ingredientId);
    res.json({ message: "Ingredient removed from product" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  addIngredientToProduct,
  updateIngredientLinkOnProduct,
  removeIngredientFromProduct,
};
