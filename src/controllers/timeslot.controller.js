const timeSlotService = require("../services/timeslot.service");

async function getAllTimeSlots(_req, res) {
  try {
    const slots = await timeSlotService.getAllTimeSlots();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getActiveTimeSlots(req, res) {
  try {
    const minStartTime = new Date(Date.now() + 15 * 60_000);
    const slots = await timeSlotService.getActiveTimeSlots(minStartTime, req.query);
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

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
    res.status(201).json({ message: `${result.count} slots created` });
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
    res.json({ message: "Slot deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteSlotsByDate(req, res) {
  try {
    const result = await timeSlotService.deleteSlotsByDate(req.params.date);
    res.json({ message: `${result.count} slots deleted` });
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
