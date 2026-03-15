const prisma = require("../lib/prisma");

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("active must be a boolean");
}

function parseRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function parseOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid string field");
  const normalized = value.trim();
  return normalized || null;
}

function parseOptionalDecimal(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`${fieldName} must be a valid number`);
  return parsed;
}

async function getLocations(filters = {}) {
  const active = parseOptionalBoolean(filters.active);
  const where = active === undefined ? undefined : { active };

  return prisma.location.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

async function getLocationById(id) {
  const locationId = parsePositiveInt(id, "id");
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });
  if (!location) throw new Error("Location not found");
  return location;
}

async function createLocation(data) {
  const city = parseRequiredString(data.city, "city");
  return prisma.location.create({
    data: {
      name: city,
      addressLine1: parseRequiredString(data.addressLine1, "addressLine1"),
      addressLine2: parseOptionalString(data.addressLine2),
      postalCode: parseRequiredString(data.postalCode, "postalCode"),
      city,
      country:
        typeof data.country === "string" && data.country.trim()
          ? data.country.trim()
          : "France",
      latitude: parseOptionalDecimal(data.latitude, "latitude"),
      longitude: parseOptionalDecimal(data.longitude, "longitude"),
      notes: parseOptionalString(data.notes),
      active: parseOptionalBoolean(data.active) ?? true,
    },
  });
}

async function updateLocation(id, data) {
  const locationId = parsePositiveInt(id, "id");
  const existing = await prisma.location.findUnique({ where: { id: locationId } });
  if (!existing) throw new Error("Location not found");

  const nextCity =
    data.city === undefined ? existing.city : parseRequiredString(data.city, "city");

  return prisma.location.update({
    where: { id: locationId },
    data: {
      name: nextCity,
      addressLine1:
        data.addressLine1 === undefined
          ? undefined
          : parseRequiredString(data.addressLine1, "addressLine1"),
      addressLine2: parseOptionalString(data.addressLine2),
      postalCode:
        data.postalCode === undefined
          ? undefined
          : parseRequiredString(data.postalCode, "postalCode"),
      city: nextCity,
      country:
        data.country === undefined
          ? undefined
          : parseRequiredString(data.country, "country"),
      latitude: parseOptionalDecimal(data.latitude, "latitude"),
      longitude: parseOptionalDecimal(data.longitude, "longitude"),
      notes: parseOptionalString(data.notes),
      active: parseOptionalBoolean(data.active),
    },
  });
}

async function activateLocation(id, active) {
  const locationId = parsePositiveInt(id, "id");
  return prisma.location.update({
    where: { id: locationId },
    data: { active: parseOptionalBoolean(active) ?? false },
  });
}

async function deleteLocation(id) {
  const locationId = parsePositiveInt(id, "id");
  return prisma.location.delete({ where: { id: locationId } });
}

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  activateLocation,
  deleteLocation,
};
