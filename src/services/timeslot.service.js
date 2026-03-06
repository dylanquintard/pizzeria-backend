const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** --- Crée un créneau unique --- */
async function createTimeSlot(data) {
  const { startTime, endTime, maxPizzas, serviceDate } = data;
  return prisma.timeSlot.create({
    data: {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      maxPizzas: parseInt(maxPizzas),
      currentPizzas: 0,
      active: true,
      serviceDate: new Date(serviceDate),
    },
  });
}

/** --- Crée automatiquement tous les créneaux d'une journée --- */
async function createTimeSlots({ serviceDate, startTime, endTime, duration, maxPizzas }) {
  if (!serviceDate || !startTime || !endTime || !duration || !maxPizzas) {
    throw new Error("serviceDate, startTime, endTime, duration et maxPizzas sont requis");
  }

  const slots = [];
  const date = new Date(serviceDate);
  let current = new Date(`${date.toISOString().split("T")[0]}T${startTime}`);
  const end = new Date(`${date.toISOString().split("T")[0]}T${endTime}`);

  while (current < end) {
    let slotEnd = new Date(current.getTime() + duration * 60000);

    // Si le créneau dépasse endTime, on le raccourcit pour finir exactement à la fermeture
    if (slotEnd > end) slotEnd = new Date(end);

    slots.push({
      startTime: new Date(current),
      endTime: new Date(slotEnd),
      maxPizzas: parseInt(maxPizzas),
      currentPizzas: 0,
      active: true,
      serviceDate: new Date(date.setHours(0, 0, 0, 0)),
    });

    // Si on a atteint la fin, on sort
    if (slotEnd.getTime() >= end.getTime()) break;

    current = new Date(current.getTime() + duration * 60000);
  }

  return prisma.timeSlot.createMany({ data: slots });
}

/** --- Récupère tous les créneaux --- */
async function getAllTimeSlots() {
  return prisma.timeSlot.findMany({
    orderBy: { startTime: "asc" },
  });
}

/** --- Modifier un créneau --- */
async function updateTimeSlot(id, data) {
  return prisma.timeSlot.update({
    where: { id: parseInt(id) },
    data: {
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      maxPizzas: data.maxPizzas ? parseInt(data.maxPizzas) : undefined,
      active: typeof data.active === "boolean" ? data.active : undefined,
    },
  });
}

/** --- Activer / désactiver un créneau --- */
async function activateTimeSlot(id, active) {
  return prisma.timeSlot.update({
    where: { id: parseInt(id) },
    data: { active: !!active },
  });
}

/** --- Supprimer un créneau --- */
async function deleteTimeSlot(id) {
  return prisma.timeSlot.delete({ where: { id: parseInt(id) } });
}

/** --- Supprimer tous les créneaux d'une date --- */
async function deleteSlotsByDate(dateStr) {
  const date = new Date(dateStr);
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  return prisma.timeSlot.deleteMany({
    where: {
      startTime: { gte: startOfDay, lte: endOfDay },
    },
  });
}

module.exports = {
  createTimeSlot,
  createTimeSlots,
  getAllTimeSlots,
  updateTimeSlot,
  activateTimeSlot,
  deleteTimeSlot,
  deleteSlotsByDate,
};