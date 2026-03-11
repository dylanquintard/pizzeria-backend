const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const prisma = require("../lib/prisma");
const { UPLOAD_DIR } = require("../lib/env");

const GALLERY_DIRECTORY = path.join(UPLOAD_DIR, "gallery");
const GALLERY_THUMB_DIRECTORY = path.join(GALLERY_DIRECTORY, "thumbs");
const MAIN_IMAGE_WIDTH = 1920;
const THUMB_IMAGE_WIDTH = 640;
const THUMB_IMAGE_HEIGHT = 640;

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalBoolean(value, fieldName = "active") {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName} must be a boolean`);
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

function buildGeneratedFilename() {
  const timestamp = Date.now();
  const randomToken = crypto.randomBytes(6).toString("hex");
  return `gallery-${timestamp}-${randomToken}.webp`;
}

function normalizeUploadPath(value) {
  return String(value || "").trim().replace(/\\/g, "/");
}

function resolveLocalUploadPath(value) {
  const raw = normalizeUploadPath(value);
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch (_err) {
      return null;
    }
  }

  if (!pathname.startsWith("/uploads/")) return null;
  const relativePath = pathname.replace(/^\/uploads\/+/, "");
  if (!relativePath) return null;

  const absolutePath = path.resolve(UPLOAD_DIR, relativePath);
  const relativeFromUploadRoot = path.relative(UPLOAD_DIR, absolutePath);
  if (
    !relativeFromUploadRoot ||
    relativeFromUploadRoot.startsWith("..") ||
    path.isAbsolute(relativeFromUploadRoot)
  ) {
    return null;
  }

  return absolutePath;
}

async function removeLocalUploadIfPresent(value) {
  const absolutePath = resolveLocalUploadPath(value);
  if (!absolutePath) return;

  try {
    await fs.unlink(absolutePath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.warn("[gallery] failed to delete file", {
        path: absolutePath,
        error: err?.message || "unknown_error",
      });
    }
  }
}

async function saveUploadedGalleryImage(fileBuffer) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error("Uploaded file is empty");
  }

  await fs.mkdir(GALLERY_DIRECTORY, { recursive: true });
  await fs.mkdir(GALLERY_THUMB_DIRECTORY, { recursive: true });

  const fileName = buildGeneratedFilename();
  const imageAbsolutePath = path.join(GALLERY_DIRECTORY, fileName);
  const thumbnailAbsolutePath = path.join(GALLERY_THUMB_DIRECTORY, fileName);

  const sourceImage = sharp(fileBuffer, { failOn: "error" }).rotate();
  const metadata = await sourceImage.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Unsupported image payload");
  }

  const imageInfo = await sourceImage
    .clone()
    .resize({ width: MAIN_IMAGE_WIDTH, withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(imageAbsolutePath);

  await sourceImage
    .clone()
    .resize({
      width: THUMB_IMAGE_WIDTH,
      height: THUMB_IMAGE_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toFile(thumbnailAbsolutePath);

  return {
    imagePath: `/uploads/gallery/${fileName}`,
    thumbnailPath: `/uploads/gallery/thumbs/${fileName}`,
    width: imageInfo.width || metadata.width,
    height: imageInfo.height || metadata.height,
    sizeBytes: imageInfo.size || fileBuffer.length,
    mimeType: "image/webp",
  };
}

async function getGalleryImages(filters = {}) {
  const active = parseOptionalBoolean(filters.active);
  const where = active === undefined ? undefined : { active };

  return prisma.homeGalleryImage.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

async function createGalleryImage(data) {
  const imageUrl = parseImageUrl(data.imageUrl);
  const isHomeBackground = parseOptionalBoolean(
    data.isHomeBackground,
    "isHomeBackground"
  );
  const activeValue = parseOptionalBoolean(data.active, "active");
  const active = isHomeBackground ? true : activeValue ?? true;

  return prisma.$transaction(async (tx) => {
    if (isHomeBackground) {
      await tx.homeGalleryImage.updateMany({
        where: { isHomeBackground: true },
        data: { isHomeBackground: false },
      });
    }

    return tx.homeGalleryImage.create({
      data: {
        imageUrl,
        thumbnailUrl: parseOptionalString(data.thumbnailUrl) ?? imageUrl,
        title: parseOptionalString(data.title),
        description: parseOptionalString(data.description),
        altText: parseOptionalString(data.altText),
        sortOrder: parseSortOrder(data.sortOrder) ?? 0,
        active,
        isHomeBackground: isHomeBackground ?? false,
      },
    });
  });
}

async function updateGalleryImage(id, data) {
  const imageId = parsePositiveInt(id, "id");
  const existing = await prisma.homeGalleryImage.findUnique({
    where: { id: imageId },
  });
  if (!existing) throw new Error("Gallery image not found");

  const isHomeBackground = parseOptionalBoolean(
    data.isHomeBackground,
    "isHomeBackground"
  );
  const activeValue = parseOptionalBoolean(data.active, "active");
  const active = isHomeBackground ? true : activeValue;
  const nextIsHomeBackground =
    isHomeBackground !== undefined
      ? isHomeBackground
      : active === false
        ? false
        : undefined;

  return prisma.$transaction(async (tx) => {
    if (isHomeBackground) {
      await tx.homeGalleryImage.updateMany({
        where: { isHomeBackground: true, id: { not: imageId } },
        data: { isHomeBackground: false },
      });
    }

    return tx.homeGalleryImage.update({
      where: { id: imageId },
      data: {
        imageUrl: data.imageUrl !== undefined ? parseImageUrl(data.imageUrl) : undefined,
        thumbnailUrl: parseOptionalString(data.thumbnailUrl),
        title: parseOptionalString(data.title),
        description: parseOptionalString(data.description),
        altText: parseOptionalString(data.altText),
        sortOrder: parseSortOrder(data.sortOrder),
        active,
        isHomeBackground: nextIsHomeBackground,
      },
    });
  });
}

async function activateGalleryImage(id, active) {
  const imageId = parsePositiveInt(id, "id");
  const isActive = parseOptionalBoolean(active, "active") ?? false;

  return prisma.homeGalleryImage.update({
    where: { id: imageId },
    data: {
      active: isActive,
      isHomeBackground: isActive ? undefined : false,
    },
  });
}

async function setHomeBackground(id) {
  const imageId = parsePositiveInt(id, "id");
  const existing = await prisma.homeGalleryImage.findUnique({
    where: { id: imageId },
  });
  if (!existing) throw new Error("Gallery image not found");

  return prisma.$transaction(async (tx) => {
    await tx.homeGalleryImage.updateMany({
      where: { isHomeBackground: true },
      data: { isHomeBackground: false },
    });
    return tx.homeGalleryImage.update({
      where: { id: imageId },
      data: {
        isHomeBackground: true,
        active: true,
      },
    });
  });
}

async function deleteGalleryImage(id) {
  const imageId = parsePositiveInt(id, "id");
  const deleted = await prisma.homeGalleryImage.delete({
    where: { id: imageId },
  });
  await Promise.all([
    removeLocalUploadIfPresent(deleted.imageUrl),
    removeLocalUploadIfPresent(deleted.thumbnailUrl),
  ]);
  return deleted;
}

module.exports = {
  saveUploadedGalleryImage,
  getGalleryImages,
  createGalleryImage,
  updateGalleryImage,
  activateGalleryImage,
  setHomeBackground,
  deleteGalleryImage,
};
