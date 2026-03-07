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

function parseSortOrder(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("sortOrder must be a positive integer or zero");
  }
  return parsed;
}

function parseImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("imageUrl is required");
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

async function getGalleryImages(filters = {}) {
  const active = parseOptionalBoolean(filters.active);
  const where = active === undefined ? undefined : { active };

  return prisma.homeGalleryImage.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

async function getGalleryImageById(id) {
  const imageId = parsePositiveInt(id, "id");
  const image = await prisma.homeGalleryImage.findUnique({
    where: { id: imageId },
  });
  if (!image) throw new Error("Gallery image not found");
  return image;
}

async function createGalleryImage(data) {
  const imageUrl = parseImageUrl(data.imageUrl);

  return prisma.homeGalleryImage.create({
    data: {
      imageUrl,
      thumbnailUrl: parseOptionalString(data.thumbnailUrl) ?? imageUrl,
      title: parseOptionalString(data.title),
      description: parseOptionalString(data.description),
      altText: parseOptionalString(data.altText),
      sortOrder: parseSortOrder(data.sortOrder) ?? 0,
      active: parseOptionalBoolean(data.active) ?? true,
    },
  });
}

async function updateGalleryImage(id, data) {
  const imageId = parsePositiveInt(id, "id");
  const existing = await prisma.homeGalleryImage.findUnique({
    where: { id: imageId },
  });
  if (!existing) throw new Error("Gallery image not found");

  return prisma.homeGalleryImage.update({
    where: { id: imageId },
    data: {
      imageUrl: data.imageUrl !== undefined ? parseImageUrl(data.imageUrl) : undefined,
      thumbnailUrl: parseOptionalString(data.thumbnailUrl),
      title: parseOptionalString(data.title),
      description: parseOptionalString(data.description),
      altText: parseOptionalString(data.altText),
      sortOrder: parseSortOrder(data.sortOrder),
      active: parseOptionalBoolean(data.active),
    },
  });
}

async function activateGalleryImage(id, active) {
  const imageId = parsePositiveInt(id, "id");
  return prisma.homeGalleryImage.update({
    where: { id: imageId },
    data: { active: parseOptionalBoolean(active) ?? false },
  });
}

async function deleteGalleryImage(id) {
  const imageId = parsePositiveInt(id, "id");
  return prisma.homeGalleryImage.delete({
    where: { id: imageId },
  });
}

module.exports = {
  getGalleryImages,
  getGalleryImageById,
  createGalleryImage,
  updateGalleryImage,
  activateGalleryImage,
  deleteGalleryImage,
};
