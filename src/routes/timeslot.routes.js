const express = require("express");
const router = express.Router();
const timeSlotController = require("../controllers/timeslot.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/public-weekly-settings", timeSlotController.getPublicWeeklySettings);

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
router.delete(
  "/weekly-settings/:dayOfWeek/service",
  authMiddleware,
  adminMiddleware,
  timeSlotController.removeWeeklyService
);

router.get("/availability", authMiddleware, timeSlotController.getPickupAvailability);

module.exports = router;
