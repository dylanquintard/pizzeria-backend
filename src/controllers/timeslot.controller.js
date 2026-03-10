const timeSlotService = require("../services/timeslot.service");
const { emitRealtimeEvent } = require("../lib/realtime");

async function getWeeklySettings(_req, res) {
  try {
    const settings = await timeSlotService.getWeeklySettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPublicWeeklySettings(_req, res) {
  try {
    const settings = await timeSlotService.getWeeklySettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function upsertWeeklySetting(req, res) {
  try {
    const setting = await timeSlotService.upsertWeeklySetting(
      req.params.dayOfWeek,
      req.body
    );

    emitRealtimeEvent("timeslots:updated", {
      type: "timeslot-weekly-setting-upserted",
      dayOfWeek: setting?.dayOfWeek || String(req.params.dayOfWeek || "").toUpperCase(),
      isOpen: Boolean(setting?.isOpen),
      locationId: setting?.locationId || null,
    });

    res.json(setting);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeWeeklyService(req, res) {
  try {
    const setting = await timeSlotService.removeWeeklyService(
      req.params.dayOfWeek,
      req.body || {}
    );

    emitRealtimeEvent("timeslots:updated", {
      type: "timeslot-weekly-service-removed",
      dayOfWeek: setting?.dayOfWeek || String(req.params.dayOfWeek || "").toUpperCase(),
      isOpen: Boolean(setting?.isOpen),
    });

    res.json(setting);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getPickupAvailability(req, res) {
  try {
    const availability = await timeSlotService.getPickupAvailability(req.query);
    res.json(availability);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getWeeklySettings,
  getPublicWeeklySettings,
  upsertWeeklySetting,
  removeWeeklyService,
  getPickupAvailability,
};
