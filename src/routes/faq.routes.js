const express = require("express");
const faqController = require("../controllers/faq.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.get("/public", faqController.getPublicFaqEntries);
router.get("/admin/targets", authMiddleware, adminMiddleware, faqController.getAdminFaqTargets);
router.get("/admin", authMiddleware, adminMiddleware, faqController.getAdminFaqEntries);
router.post("/admin", authMiddleware, adminMiddleware, faqController.createFaqEntry);
router.put("/admin/:id", authMiddleware, adminMiddleware, faqController.updateFaqEntry);
router.delete("/admin/:id", authMiddleware, adminMiddleware, faqController.deleteFaqEntry);

module.exports = router;
