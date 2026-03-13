const blogService = require("../services/blog.service");

async function getPublishedBlogArticles(_req, res) {
  try {
    const articles = await blogService.getPublishedBlogArticles();
    res.json(articles);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getPublishedBlogArticleBySlug(req, res) {
  try {
    const article = await blogService.getPublishedBlogArticleBySlug(req.params.slug);
    res.json(article);
  } catch (err) {
    const status = err.message === "Article not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function getAdminBlogArticles(_req, res) {
  try {
    const articles = await blogService.getAdminBlogArticles();
    res.json(articles);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createBlogArticle(req, res) {
  try {
    const article = await blogService.createBlogArticle(req.body);
    res.status(201).json(article);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateBlogArticle(req, res) {
  try {
    const article = await blogService.updateBlogArticle(req.params.id, req.body);
    res.json(article);
  } catch (err) {
    const status = err.message === "Article not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function deleteBlogArticle(req, res) {
  try {
    const result = await blogService.deleteBlogArticle(req.params.id);
    res.json(result);
  } catch (err) {
    const status = err.message === "Article not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

module.exports = {
  createBlogArticle,
  deleteBlogArticle,
  getAdminBlogArticles,
  getPublishedBlogArticleBySlug,
  getPublishedBlogArticles,
  updateBlogArticle,
};
