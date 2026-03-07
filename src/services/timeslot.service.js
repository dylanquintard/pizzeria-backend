const prisma = require("../lib/prisma");

function parseDateTime(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }
  return date;
}

function parseServiceDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
  }

  const parsed = parseDateTime(value, "serviceDate");
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseTimeParts(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is invalid`);
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`${fieldName} is invalid`);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3] || 0),
  };
}

function buildDateTimeFromServiceDate(serviceDate, timeValue, fieldName) {
  const { hours, minutes, seconds } = parseTimeParts(timeValue, fieldName);
  return new Date(
    serviceDate.getFullYear(),
    serviceDate.getMonth(),
    serviceDate.getDate(),
    hours,
    minutes,
    seconds,
    0
  );
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseNullablePositiveInt(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parsePositiveInt(value, fieldName);
}

async function assertLocationExists(locationId) {
  if (!locationId) return;
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) throw new Error("Location not found");
}

async function createTimeSlot(data) {
  const startTime = parseDateTime(data.startTime, "startTime");
  const endTime = parseDateTime(data.endTime, "endTime");
  const maxPizzas = parsePositiveInt(data.maxPizzas, "maxPizzas");
  const serviceDate = parseServiceDate(data.serviceDate || startTime);
  const locationId = parseNullablePositiveInt(data.locationId, "locationId");

  if (endTime <= startTime) {
    throw new Error("endTime must be after startTime");
  }

  await assertLocationExists(locationId);

  return prisma.timeSlot.create({
    data: {
      startTime,
      endTime,
      maxPizzas,
      currentPizzas: 0,
      active: true,
      serviceDate,
      locationId,
    },
    include: { location: true },
  });
}

async function createTimeSlots({
  serviceDate,
  startTime,
  endTime,
  duration,
  maxPizzas,
  locationId,
}) {
  if (!serviceDate || !startTime || !endTime || !duration || !maxPizzas) {
    throw new Error(
      "serviceDate, startTime, endTime, duration and maxPizzas are required"
    );
  }

  const slotDurationMinutes = parsePositiveInt(duration, "duration");
  const capacity = parsePositiveInt(maxPizzas, "maxPizzas");
  const parsedLocationId = parseNullablePositiveInt(locationId, "locationId");
  await assertLocationExists(parsedLocationId);

  const day = parseServiceDate(serviceDate);
  let current = buildDateTimeFromServiceDate(day, startTime, "startTime");
  const end = buildDateTimeFromServiceDate(day, endTime, "endTime");

  if (end <= current) {
    throw new Error("endTime must be after startTime");
  }

  const slots = [];

  while (current < end) {
    let slotEnd = new Date(current.getTime() + slotDurationMinutes * 60_000);
    if (slotEnd > end) slotEnd = new Date(end);

    slots.push({
      startTime: new Date(current),
      endTime: new Date(slotEnd),
      maxPizzas: capacity,
      currentPizzas: 0,
      active: true,
      serviceDate: new Date(day),
      locationId: parsedLocationId,
    });

    if (slotEnd.getTime() >= end.getTime()) break;
    current = new Date(slotEnd);
  }

  return prisma.timeSlot.createMany({ data: slots });
}

async function getAllTimeSlots() {
  return prisma.timeSlot.findMany({
    include: { location: true },
    orderBy: { startTime: "asc" },
  });
}

async function getActiveTimeSlots(minStartTime, filters = {}) {
  const threshold = parseDateTime(minStartTime, "minStartTime");
  const locationId = parseNullablePositiveInt(filters.locationId, "locationId");

  const slots = await prisma.timeSlot.findMany({
    where: {
      active: true,
      startTime: { gte: threshold },
      locationId: locationId === undefined ? undefined : locationId,
    },
    include: { location: true },
    orderBy: { startTime: "asc" },
  });

  return slots.filter((slot) => slot.currentPizzas < slot.maxPizzas);
}

async function updateTimeSlot(id, data) {
  const parsedId = parsePositiveInt(id, "id");
  const locationId = parseNullablePositiveInt(data.locationId, "locationId");
  await assertLocationExists(locationId);

  return prisma.timeSlot.update({
    where: { id: parsedId },
    data: {
      startTime: data.startTime
        ? parseDateTime(data.startTime, "startTime")
        : undefined,
      endTime: data.endTime ? parseDateTime(data.endTime, "endTime") : undefined,
      maxPizzas:
        data.maxPizzas !== undefined
          ? parsePositiveInt(data.maxPizzas, "maxPizzas")
          : undefined,
      active: typeof data.active === "boolean" ? data.active : undefined,
      serviceDate: data.serviceDate
        ? parseServiceDate(data.serviceDate)
        : undefined,
      locationId,
    },
    include: { location: true },
  });
}

async function activateTimeSlot(id, active) {
  const parsedId = parsePositiveInt(id, "id");
  return prisma.timeSlot.update({
    where: { id: parsedId },
    data: { active: Boolean(active) },
    include: { location: true },
  });
}

async function deleteTimeSlot(id) {
  const parsedId = parsePositiveInt(id, "id");
  return prisma.timeSlot.delete({ where: { id: parsedId } });
}

async function deleteSlotsByDate(dateStr) {
  const serviceDate = parseServiceDate(dateStr);
  const nextDate = new Date(serviceDate);
  nextDate.setDate(nextDate.getDate() + 1);

  return prisma.timeSlot.deleteMany({
    where: {
      serviceDate: {
        gte: serviceDate,
        lt: nextDate,
      },
    },
  });
}

module.exports = {
  createTimeSlot,
  createTimeSlots,
  getAllTimeSlots,
  getActiveTimeSlots,
  updateTimeSlot,
  activateTimeSlot,
  deleteTimeSlot,
  deleteSlotsByDate,
};
