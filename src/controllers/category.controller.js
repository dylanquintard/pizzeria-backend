const categoryService = require("../services/category.service");

async function getCategories(req, res) {
  try {
    const categories = await categoryService.getCategories(req.query);
    res.json(categories);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getCategoryById(req, res) {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.json(category);
  } catch (err) {
    const status = err.message === "Category not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function createCategory(req, res) {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateCategory(req, res) {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.json(category);
  } catch (err) {
    const status = err.message === "Category not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function activateCategory(req, res) {
  try {
    const category = await categoryService.activateCategory(
      req.params.id,
      req.body.active
    );
    res.json(category);
  } catch (err) {
    const status = err.message === "Category not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function deleteCategory(req, res) {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    const status = err.message === "Category not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  activateCategory,
  deleteCategory,
};
