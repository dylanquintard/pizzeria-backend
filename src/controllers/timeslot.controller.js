const timeSlotService = require("../services/timeslot.service");

/** --- CLIENT / ADMIN --- */
async function getAllTimeSlots(req, res) {
  try {
    const slots = await timeSlotService.getAllTimeSlots();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getActiveTimeSlots(req, res) {
  try {
    const now = new Date();
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);

    const slots = await timeSlotService.getAllTimeSlots(); // récupère tous les créneaux

    const availableSlots = slots.filter(slot => {
      const slotStart = new Date(slot.startTime);
      return slot.active && (slot.maxPizzas - slot.currentPizzas) > 0 && slotStart >= fifteenMinutesLater;
    });

    res.json(availableSlots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** --- ADMIN --- */
async function createTimeSlot(req, res) {
  try {
    const slot = await timeSlotService.createTimeSlot(req.body);
    res.status(201).json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createTimeSlotsBatch(req, res) {
  try {
    const result = await timeSlotService.createTimeSlots(req.body);
    res.status(201).json({ message: `${result.count} créneaux créés` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateTimeSlot(req, res) {
  try {
    const slot = await timeSlotService.updateTimeSlot(req.params.id, req.body);
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function activateTimeSlot(req, res) {
  try {
    const slot = await timeSlotService.activateTimeSlot(req.params.id, req.body.active);
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteTimeSlot(req, res) {
  try {
    await timeSlotService.deleteTimeSlot(req.params.id);
    res.json({ message: "Créneau supprimé" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteSlotsByDate(req, res) {
  try {
    const result = await timeSlotService.deleteSlotsByDate(req.params.date);
    res.json({ message: `${result.count} créneaux supprimés` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getAllTimeSlots,
  getActiveTimeSlots,
  createTimeSlot,
  createTimeSlotsBatch,
  updateTimeSlot,
  activateTimeSlot,
  deleteTimeSlot,
  deleteSlotsByDate,
};