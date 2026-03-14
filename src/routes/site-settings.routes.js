const express = require("express");
const siteSettingsController = require("../controllers/site-settings.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.get("/public", siteSettingsController.getPublicSiteSettings);
router.get("/admin", authMiddleware, adminMiddleware, siteSettingsController.getAdminSiteSettings);
router.post("/translate-to-english", authMiddleware, adminMiddleware, siteSettingsController.translateSiteSettingsToEnglish);
router.put("/", authMiddleware, adminMiddleware, siteSettingsController.updateSiteSettings);

module.exports = router;
