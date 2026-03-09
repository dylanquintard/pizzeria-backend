const locationService = require("../services/location.service");
const { emitRealtimeEvent } = require("../lib/realtime");

async function getLocations(req, res) {
  try {
    const locations = await locationService.getLocations(req.query);
    res.json(locations);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getLocationById(req, res) {
  try {
    const location = await locationService.getLocationById(req.params.id);
    res.json(location);
  } catch (err) {
    const status = err.message === "Location not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function createLocation(req, res) {
  try {
    const location = await locationService.createLocation(req.body);
    emitRealtimeEvent("locations:updated", {
      type: "location-created",
      locationId: location?.id || null,
    });
    res.status(201).json(location);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateLocation(req, res) {
  try {
    const location = await locationService.updateLocation(req.params.id, req.body);
    emitRealtimeEvent("locations:updated", {
      type: "location-updated",
      locationId: location?.id || Number(req.params.id),
    });
    res.json(location);
  } catch (err) {
    const status = err.message === "Location not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function activateLocation(req, res) {
  try {
    const location = await locationService.activateLocation(
      req.params.id,
      req.body.active
    );
    emitRealtimeEvent("locations:updated", {
      type: "location-activation-updated",
      locationId: location?.id || Number(req.params.id),
      active: Boolean(location?.active),
    });
    res.json(location);
  } catch (err) {
    const status = err.message === "Location not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function deleteLocation(req, res) {
  try {
    await locationService.deleteLocation(req.params.id);
    emitRealtimeEvent("locations:updated", {
      type: "location-deleted",
      locationId: Number(req.params.id),
    });
    res.json({ message: "Location deleted" });
  } catch (err) {
    const status = err.message === "Location not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  activateLocation,
  deleteLocation,
};
