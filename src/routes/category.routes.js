const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/", categoryController.getCategories);
router.get("/:id", categoryController.getCategoryById);

router.post("/", authMiddleware, adminMiddleware, categoryController.createCategory);
router.put("/:id", authMiddleware, adminMiddleware, categoryController.updateCategory);
router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  categoryController.activateCategory
);
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  categoryController.deleteCategory
);

module.exports = router;
