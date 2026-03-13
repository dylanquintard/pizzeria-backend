const express = require("express");
const seoController = require("../controllers/seo.controller");

const router = express.Router();

router.get("/sitemap.xml", seoController.getSitemapXml);
router.get("/blog-slugs", seoController.getBlogSlugs);
router.get("/blog-articles", seoController.getSeoBlogArticles);
router.get("/locations", seoController.getSeoLocations);

module.exports = router;
