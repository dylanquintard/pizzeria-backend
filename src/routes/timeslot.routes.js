const express = require("express");
const router = express.Router();
const timeSlotController = require("../controllers/timeslot.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get(
  "/weekly-settings",
  authMiddleware,
  adminMiddleware,
  timeSlotController.getWeeklySettings
);
router.put(
  "/weekly-settings/:dayOfWeek",
  authMiddleware,
  adminMiddleware,
  timeSlotController.upsertWeeklySetting
);

router.get("/availability", authMiddleware, timeSlotController.getPickupAvailability);

module.exports = router;
