const express = require("express");
const router = express.Router();
const realtimeController = require("../controllers/realtime.controller");
const { authMiddleware } = require("../middlewares/auth");

router.get("/stream", authMiddleware, realtimeController.stream);

module.exports = router;
