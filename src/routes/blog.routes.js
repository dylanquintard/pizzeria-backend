const express = require("express");
const blogController = require("../controllers/blog.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.get("/", blogController.getPublishedBlogArticles);
router.get("/slug/:slug", blogController.getPublishedBlogArticleBySlug);
router.get("/admin/all", authMiddleware, adminMiddleware, blogController.getAdminBlogArticles);
router.post("/", authMiddleware, adminMiddleware, blogController.createBlogArticle);
router.put("/:id", authMiddleware, adminMiddleware, blogController.updateBlogArticle);
router.delete("/:id", authMiddleware, adminMiddleware, blogController.deleteBlogArticle);

module.exports = router;
