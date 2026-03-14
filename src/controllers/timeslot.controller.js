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
      agentId: setting?.agentId || null,
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

async function getConcreteSlotsForService(req, res) {
  try {
    const slots = await timeSlotService.getConcreteSlotsForService(req.query);
    res.json(slots);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateConcreteSlotActiveState(req, res) {
  try {
    const slot = await timeSlotService.updateConcreteSlotActiveState(req.body || {});

    emitRealtimeEvent("timeslots:updated", {
      type: "timeslot-concrete-slot-updated",
      slotId: slot?.slotId || null,
      locationId: slot?.locationId || null,
      pickupTime: slot?.pickupTime || null,
      date: slot?.date || null,
      active: Boolean(slot?.active),
    });

    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listTruckClosures(_req, res) {
  try {
    const closures = await timeSlotService.listTruckClosures();
    res.json(closures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createTruckClosure(req, res) {
  try {
    const closure = await timeSlotService.createTruckClosure(req.body || {});

    emitRealtimeEvent("timeslots:updated", {
      type: "timeslot-truck-closure-created",
      closureId: closure?.id || null,
      agentId: closure?.agentId || null,
    });

    res.status(201).json(closure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteTruckClosure(req, res) {
  try {
    const result = await timeSlotService.deleteTruckClosure(req.params.closureId);

    emitRealtimeEvent("timeslots:updated", {
      type: "timeslot-truck-closure-deleted",
      closureId: Number(req.params.closureId) || null,
    });

    res.json(result);
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
  getConcreteSlotsForService,
  updateConcreteSlotActiveState,
  listTruckClosures,
  createTruckClosure,
  deleteTruckClosure,
};
