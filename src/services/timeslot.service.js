const prisma = require("../lib/prisma");
const {
  DAY_DEFINITIONS,
  ANCHOR_WEEK_START,
  ANCHOR_WEEK_END,
  parseIsoDate,
  formatIsoDate,
  formatTimeValue,
  buildDateTime,
  addDays,
  parseDayOfWeek,
  getDayOfWeekKey,
  getAnchorDateForDay,
  getDateRange,
  minutesBetween,
} = require("../utils/weekly-timeslots");

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName} must be a boolean`);
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  return parsePositiveInt(value, fieldName);
}

function parseOptionalText(value, fieldName, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} is too long`);
  }
  return normalized;
}

const TIMESLOT_INCLUDE = {
  location: true,
  agent: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  },
};

async function assertLocationExists(locationId) {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) throw new Error("Location not found");
  if (!location.active) throw new Error("Location must be active");
  return location;
}

async function assertPrintAgentExists(agentId) {
  const agent = await prisma.printAgent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error("Print agent not found");
  return agent;
}

function buildTemplateRows({
  dayOfWeek,
  startTime,
  endTime,
  slotDuration,
  maxPizzas,
  locationId,
  agentId,
}) {
  const anchorDate = getAnchorDateForDay(dayOfWeek);
  const range = getDateRange(anchorDate);
  const firstStart = buildDateTime(anchorDate, startTime, "startTime");
  const lastEnd = buildDateTime(anchorDate, endTime, "endTime");
  const duration = parsePositiveInt(slotDuration, "slotDuration");
  const capacity = parsePositiveInt(maxPizzas, "maxPizzas");

  if (lastEnd <= firstStart) {
    throw new Error("endTime must be after startTime");
  }

  const rows = [];
  let current = new Date(firstStart.getTime());

  while (current < lastEnd) {
    const nextEnd = new Date(Math.min(lastEnd.getTime(), current.getTime() + duration * 60_000));

    rows.push({
      startTime: new Date(current),
      endTime: new Date(nextEnd),
      maxPizzas: capacity,
      currentPizzas: 0,
      active: true,
      serviceDate: range.start,
      locationId,
      agentId,
    });

    if (nextEnd.getTime() >= lastEnd.getTime()) break;
    current = new Date(nextEnd.getTime());
  }

  return rows;
}

function closedSetting(dayOfWeek) {
  return {
    dayOfWeek,
    isOpen: false,
    startTime: null,
    endTime: null,
    slotDuration: null,
    maxPizzas: null,
    locationId: null,
    location: null,
    agentId: null,
    agent: null,
    slotsCount: 0,
    services: [],
  };
}

function buildServiceEntries(dayOfWeek, slots) {
  if (!Array.isArray(slots) || slots.length === 0) return [];

  const byMergeKey = new Map();
  for (const slot of slots) {
    const slotDuration = Math.max(1, minutesBetween(slot.startTime, slot.endTime));
    const mergeKey = `${slot.locationId || "none"}|${slot.agentId || "none"}|${slot.maxPizzas}|${slotDuration}`;

    if (!byMergeKey.has(mergeKey)) {
      byMergeKey.set(mergeKey, []);
    }
    byMergeKey.get(mergeKey).push(slot);
  }

  const mergedServices = [];

  for (const groupSlots of byMergeKey.values()) {
    const ordered = [...groupSlots].sort((a, b) => {
      const startDiff = new Date(a.startTime) - new Date(b.startTime);
      if (startDiff !== 0) return startDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });

    let current = null;

    for (const slot of ordered) {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      const slotDuration = Math.max(1, minutesBetween(slot.startTime, slot.endTime));

      const canMerge =
        current &&
        current._lastEnd.getTime() === slotStart.getTime();

      if (canMerge) {
        current.endTime = formatTimeValue(slotEnd);
        current.slotsCount += 1;
        current._lastEnd = slotEnd;
        continue;
      }

      if (current) {
        delete current._lastEnd;
        mergedServices.push(current);
      }

      current = {
        id: `${dayOfWeek}-${slot.locationId || "none"}-${slot.agentId || "none"}-${formatTimeValue(slotStart)}-${formatTimeValue(slotEnd)}-${slot.maxPizzas}-${slotDuration}`,
        startTime: formatTimeValue(slotStart),
        endTime: formatTimeValue(slotEnd),
        slotDuration,
        maxPizzas: slot.maxPizzas,
        locationId: slot.locationId,
        location: slot.location || null,
        agentId: slot.agentId || null,
        agent: slot.agent || null,
        slotsCount: 1,
        _lastEnd: slotEnd,
      };
    }

    if (current) {
      delete current._lastEnd;
      mergedServices.push(current);
    }
  }

  return mergedServices.sort((a, b) => {
    const startDiff =
      buildDateTime(getAnchorDateForDay(dayOfWeek), a.startTime, "startTime") -
      buildDateTime(getAnchorDateForDay(dayOfWeek), b.startTime, "startTime");
    if (startDiff !== 0) return startDiff;
    const locationDiff = Number(a.locationId || 0) - Number(b.locationId || 0);
    if (locationDiff !== 0) return locationDiff;
    const agentDiff = Number(a.agentId || 0) - Number(b.agentId || 0);
    if (agentDiff !== 0) return agentDiff;
    return String(a.id).localeCompare(String(b.id));
  });
}

function buildWeeklySetting(dayOfWeek, slots) {
  const services = buildServiceEntries(dayOfWeek, slots);
  if (services.length === 0) return closedSetting(dayOfWeek);

  const first = services[0];
  const totalSlots = services.reduce(
    (sum, entry) => sum + Number(entry.slotsCount || 0),
    0
  );

  return {
    dayOfWeek,
    isOpen: true,
    startTime: first.startTime,
    endTime: first.endTime,
    slotDuration: first.slotDuration,
    maxPizzas: first.maxPizzas,
    locationId: first.locationId,
    location: first.location || null,
    agentId: first.agentId || null,
    agent: first.agent || null,
    slotsCount: totalSlots,
    services,
  };
}

async function getWeeklySettingByDay(dayOfWeek) {
  const parsedDay = parseDayOfWeek(dayOfWeek);
  const anchorDate = getAnchorDateForDay(parsedDay);
  const range = getDateRange(anchorDate);

  const slots = await prisma.timeSlot.findMany({
    where: {
      serviceDate: {
        gte: range.start,
        lt: range.end,
      },
    },
    include: TIMESLOT_INCLUDE,
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  return buildWeeklySetting(parsedDay, slots);
}

async function getWeeklySettings() {
  const slots = await prisma.timeSlot.findMany({
    where: {
      serviceDate: {
        gte: ANCHOR_WEEK_START,
        lt: ANCHOR_WEEK_END,
      },
    },
    include: TIMESLOT_INCLUDE,
    orderBy: [{ serviceDate: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const groupedByDay = new Map();
  for (const slot of slots) {
    const dayOfWeek = getDayOfWeekKey(slot.serviceDate);
    if (!groupedByDay.has(dayOfWeek)) {
      groupedByDay.set(dayOfWeek, []);
    }
    groupedByDay.get(dayOfWeek).push(slot);
  }

  return DAY_DEFINITIONS.map((definition) =>
    buildWeeklySetting(definition.key, groupedByDay.get(definition.key) || [])
  );
}

async function upsertWeeklySetting(dayOfWeek, payload = {}) {
  const parsedDay = parseDayOfWeek(dayOfWeek);
  const shouldOpen = parseOptionalBoolean(payload.isOpen, "isOpen") !== false;
  const anchorDate = getAnchorDateForDay(parsedDay);
  const range = getDateRange(anchorDate);

  if (!shouldOpen) {
    await prisma.timeSlot.deleteMany({
      where: {
        serviceDate: {
          gte: range.start,
          lt: range.end,
        },
      },
    });

    return buildWeeklySetting(parsedDay, []);
  }

  if (!payload.startTime) throw new Error("startTime is required");
  if (!payload.endTime) throw new Error("endTime is required");
  if (payload.slotDuration === undefined) throw new Error("slotDuration is required");
  if (payload.maxPizzas === undefined) throw new Error("maxPizzas is required");

  const locationId = parseOptionalPositiveInt(payload.locationId, "locationId");
  if (!locationId) {
    throw new Error("locationId is required");
  }
  const agentId = parseOptionalPositiveInt(payload.agentId, "agentId");

  await assertLocationExists(locationId);
  if (agentId) {
    await assertPrintAgentExists(agentId);
  }

  const serviceStart = buildDateTime(anchorDate, payload.startTime, "startTime");
  const serviceEnd = buildDateTime(anchorDate, payload.endTime, "endTime");
  if (serviceEnd <= serviceStart) {
    throw new Error("endTime must be after startTime");
  }

  const overlapCount = await prisma.timeSlot.count({
    where: {
      serviceDate: {
        gte: range.start,
        lt: range.end,
      },
      locationId,
      startTime: { lt: serviceEnd },
      endTime: { gt: serviceStart },
    },
  });
  if (overlapCount > 0) {
    throw new Error(
      "Un service existe deja sur ce meme emplacement et ce meme horaire."
    );
  }

  const templateRows = buildTemplateRows({
    dayOfWeek: parsedDay,
    startTime: payload.startTime,
    endTime: payload.endTime,
    slotDuration: payload.slotDuration,
    maxPizzas: payload.maxPizzas,
    locationId,
    agentId: agentId || null,
  });

  await prisma.timeSlot.createMany({ data: templateRows });
  return getWeeklySettingByDay(parsedDay);
}

async function removeWeeklyService(dayOfWeek, payload = {}) {
  const parsedDay = parseDayOfWeek(dayOfWeek);
  const anchorDate = getAnchorDateForDay(parsedDay);
  const range = getDateRange(anchorDate);

  if (!payload.startTime) throw new Error("startTime is required");
  if (!payload.endTime) throw new Error("endTime is required");

  const locationId = parseOptionalPositiveInt(payload.locationId, "locationId");
  if (!locationId) {
    throw new Error("locationId is required");
  }

  const serviceStart = buildDateTime(anchorDate, payload.startTime, "startTime");
  const serviceEnd = buildDateTime(anchorDate, payload.endTime, "endTime");
  if (serviceEnd <= serviceStart) {
    throw new Error("endTime must be after startTime");
  }

  const deleted = await prisma.timeSlot.deleteMany({
    where: {
      serviceDate: {
        gte: range.start,
        lt: range.end,
      },
      locationId,
      startTime: { gte: serviceStart },
      endTime: { lte: serviceEnd },
    },
  });

  if (deleted.count === 0) {
    throw new Error("Service introuvable pour ce jour");
  }

  return getWeeklySettingByDay(parsedDay);
}

function buildConcreteReservationMap(slots = []) {
  const reservedByKey = new Map();

  for (const slot of slots) {
    if (!slot.locationId) continue;
    const key = `${slot.locationId}:${formatTimeValue(slot.startTime)}`;
    const currentValue = reservedByKey.get(key) || 0;
    reservedByKey.set(key, currentValue + Number(slot.currentPizzas || 0));
  }

  return reservedByKey;
}

async function getClosedAgentIdsForDate(dbClient, serviceDate, candidateAgentIds = []) {
  const normalizedDate = parseIsoDate(serviceDate, "serviceDate");
  const agentIds = [...new Set(candidateAgentIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  if (agentIds.length === 0) return new Set();

  const closures = await dbClient.printAgentClosure.findMany({
    where: {
      agentId: { in: agentIds },
      startDate: { lte: normalizedDate },
      endDate: { gte: normalizedDate },
    },
    select: { agentId: true },
  });

  return new Set(closures.map((entry) => Number(entry.agentId)));
}

async function assertAgentOpenForDate(dbClient, agentId, serviceDate) {
  const parsedAgentId = parseOptionalPositiveInt(agentId, "agentId");
  if (!parsedAgentId) return;

  const closedAgentIds = await getClosedAgentIdsForDate(dbClient, serviceDate, [parsedAgentId]);
  if (closedAgentIds.has(parsedAgentId)) {
    throw new Error("Selected pickup slot is unavailable (truck closed)");
  }
}

async function getPickupAvailability(params = {}) {
  const requestedDate = parseIsoDate(params.date || new Date(), "date");
  const requestedQuantity =
    params.quantity === undefined ? 1 : parsePositiveInt(params.quantity, "quantity");

  const dayOfWeek = getDayOfWeekKey(requestedDate);
  const anchorDate = getAnchorDateForDay(dayOfWeek);
  const templateRange = getDateRange(anchorDate);
  const concreteRange = getDateRange(requestedDate);

  const [templateSlots, concreteSlots] = await Promise.all([
    prisma.timeSlot.findMany({
      where: {
        serviceDate: {
          gte: templateRange.start,
          lt: templateRange.end,
        },
        active: true,
        locationId: { not: null },
      },
      include: TIMESLOT_INCLUDE,
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
    prisma.timeSlot.findMany({
      where: {
        serviceDate: {
          gte: concreteRange.start,
          lt: concreteRange.end,
        },
        startTime: {
          gte: concreteRange.start,
          lt: concreteRange.end,
        },
        locationId: { not: null },
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
  ]);

  const closedAgentIds = await getClosedAgentIdsForDate(
    prisma,
    requestedDate,
    templateSlots.map((slot) => slot.agentId)
  );

  const reservedByKey = buildConcreteReservationMap(concreteSlots);
  const minStartTime = new Date(Date.now() + 30 * 60_000);

  const slots = templateSlots
    .filter((slot) => {
      if (!slot.location || !slot.location.active) return false;
      if (slot.agentId && closedAgentIds.has(Number(slot.agentId))) return false;
      return true;
    })
    .map((templateSlot) => {
      const pickupTime = formatTimeValue(templateSlot.startTime);
      const concreteStart = buildDateTime(requestedDate, pickupTime, "pickupTime");
      const slotDuration = Math.max(
        1,
        minutesBetween(templateSlot.startTime, templateSlot.endTime)
      );
      const concreteEnd = new Date(concreteStart.getTime() + slotDuration * 60_000);
      const key = `${templateSlot.locationId}:${pickupTime}`;
      const currentPizzas = Number(reservedByKey.get(key) || 0);
      const maxPizzas = Number(templateSlot.maxPizzas || 0);
      const remainingCapacity = Math.max(0, maxPizzas - currentPizzas);

      return {
        pickupDate: formatIsoDate(requestedDate),
        pickupTime,
        startTime: concreteStart,
        endTime: concreteEnd,
        maxPizzas,
        currentPizzas,
        remainingCapacity,
        availableForQuantity: remainingCapacity >= requestedQuantity,
        locationId: templateSlot.locationId,
        location: templateSlot.location,
        agentId: templateSlot.agentId || null,
        agent: templateSlot.agent || null,
      };
    })
    .filter((slot) => slot.startTime >= minStartTime)
    .sort((a, b) => {
      const startDiff = new Date(a.startTime) - new Date(b.startTime);
      if (startDiff !== 0) return startDiff;
      return Number(a.locationId || 0) - Number(b.locationId || 0);
    });

  return {
    date: formatIsoDate(requestedDate),
    dayOfWeek,
    quantity: requestedQuantity,
    slots,
  };
}

async function getTemplateSlotForPickupSelection(
  dbClient,
  { pickupDate, pickupTime, locationId }
) {
  const serviceDate = parseIsoDate(pickupDate, "pickupDate");
  const parsedLocationId = parsePositiveInt(locationId, "locationId");
  const dayOfWeek = getDayOfWeekKey(serviceDate);
  const anchorDate = getAnchorDateForDay(dayOfWeek);
  const templateRange = getDateRange(anchorDate);
  const templateStartTime = buildDateTime(anchorDate, pickupTime, "pickupTime");

  return dbClient.timeSlot.findFirst({
    where: {
      serviceDate: {
        gte: templateRange.start,
        lt: templateRange.end,
      },
      locationId: parsedLocationId,
      active: true,
      startTime: templateStartTime,
    },
    orderBy: { id: "asc" },
  });
}

async function findOrCreateConcreteSlotForPickup(
  dbClient,
  { pickupDate, pickupTime, locationId }
) {
  const serviceDate = parseIsoDate(pickupDate, "pickupDate");
  const parsedLocationId = parsePositiveInt(locationId, "locationId");
  const concreteRange = getDateRange(serviceDate);
  const concreteStartTime = buildDateTime(serviceDate, pickupTime, "pickupTime");

  const templateSlot = await getTemplateSlotForPickupSelection(dbClient, {
    pickupDate: serviceDate,
    pickupTime,
    locationId: parsedLocationId,
  });

  if (!templateSlot) {
    throw new Error("Selected pickup slot is not available");
  }

  await assertAgentOpenForDate(dbClient, templateSlot.agentId, serviceDate);

  const slotDuration = Math.max(1, minutesBetween(templateSlot.startTime, templateSlot.endTime));
  const concreteEndTime = new Date(concreteStartTime.getTime() + slotDuration * 60_000);

  const concreteWhere = {
    serviceDate: {
      gte: concreteRange.start,
      lt: concreteRange.end,
    },
    locationId: parsedLocationId,
    startTime: concreteStartTime,
  };

  const existingConcreteSlot = await dbClient.timeSlot.findFirst({
    where: concreteWhere,
    orderBy: { id: "asc" },
  });

  if (!existingConcreteSlot) {
    await dbClient.timeSlot.create({
      data: {
        startTime: concreteStartTime,
        endTime: concreteEndTime,
        maxPizzas: templateSlot.maxPizzas,
        currentPizzas: 0,
        active: true,
        serviceDate: concreteRange.start,
        locationId: parsedLocationId,
        agentId: templateSlot.agentId || null,
      },
    });
  }

  const allMatchingSlots = await dbClient.timeSlot.findMany({
    where: concreteWhere,
    orderBy: { id: "asc" },
  });

  if (!allMatchingSlots.length) {
    throw new Error("Unable to create pickup slot");
  }

  const primarySlot = allMatchingSlots[0];
  const deletableDuplicateIds = allMatchingSlots
    .slice(1)
    .filter((slot) => Number(slot.currentPizzas || 0) === 0)
    .map((slot) => slot.id);

  if (deletableDuplicateIds.length) {
    await dbClient.timeSlot.deleteMany({
      where: { id: { in: deletableDuplicateIds } },
    });
  }

  return primarySlot;
}

async function listTruckClosures() {
  return prisma.printAgentClosure.findMany({
    include: {
      agent: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
}

async function createTruckClosure(payload = {}) {
  const agentId = parsePositiveInt(payload.agentId, "agentId");
  const startDate = parseIsoDate(payload.startDate, "startDate");
  const endDate = parseIsoDate(payload.endDate, "endDate");
  const reason = parseOptionalText(payload.reason, "reason", 500);

  if (endDate < startDate) {
    throw new Error("endDate must be after or equal to startDate");
  }

  await assertPrintAgentExists(agentId);

  const overlapCount = await prisma.printAgentClosure.count({
    where: {
      agentId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlapCount > 0) {
    throw new Error("A closure already exists for this truck in the selected range");
  }

  return prisma.printAgentClosure.create({
    data: {
      agentId,
      startDate,
      endDate,
      reason,
    },
    include: {
      agent: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function deleteTruckClosure(closureId) {
  const id = parsePositiveInt(closureId, "closureId");

  const existing = await prisma.printAgentClosure.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Truck closure not found");
  }

  await prisma.printAgentClosure.delete({ where: { id } });
  return { ok: true, deletedId: id };
}

module.exports = {
  getWeeklySettings,
  upsertWeeklySetting,
  removeWeeklyService,
  getPickupAvailability,
  getTemplateSlotForPickupSelection,
  findOrCreateConcreteSlotForPickup,
  listTruckClosures,
  createTruckClosure,
  deleteTruckClosure,
};
