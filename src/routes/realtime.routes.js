const express = require("express");
const router = express.Router();
const realtimeController = require("../controllers/realtime.controller");
const webPushController = require("../controllers/web-push.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/stream", authMiddleware, realtimeController.stream);
router.get("/push/public-key", authMiddleware, adminMiddleware, webPushController.getPublicVapidKey);
router.post("/push/subscriptions", authMiddleware, adminMiddleware, webPushController.upsertSubscription);
router.delete("/push/subscriptions", authMiddleware, adminMiddleware, webPushController.deleteSubscription);

module.exports = router;
