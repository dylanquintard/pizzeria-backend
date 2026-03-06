const express = require("express");
const router = express.Router();
const timeSlotController = require("../controllers/timeslot.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

// --- CLIENT & ADMIN ---
router.get("/", timeSlotController.getAllTimeSlots);
router.get("/active", timeSlotController.getActiveTimeSlots);

// --- ADMIN ---
router.post("/", authMiddleware, adminMiddleware, timeSlotController.createTimeSlot);
router.post("/batch", authMiddleware, adminMiddleware, timeSlotController.createTimeSlotsBatch);

router.put("/:id", authMiddleware, adminMiddleware, timeSlotController.updateTimeSlot);
router.patch("/:id/activate", authMiddleware, adminMiddleware, timeSlotController.activateTimeSlot);
router.delete("/:id", authMiddleware, adminMiddleware, timeSlotController.deleteTimeSlot);
router.delete("/date/:date", authMiddleware, adminMiddleware, timeSlotController.deleteSlotsByDate);

module.exports = router;