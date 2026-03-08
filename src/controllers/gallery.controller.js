const galleryService = require("../services/gallery.service");
const { UPLOAD_PUBLIC_BASE_URL } = require("../lib/env");

function buildPublicAssetUrl(req, assetPath) {
  const normalizedPath = String(assetPath || "").trim();
  if (!normalizedPath) return normalizedPath;

  if (UPLOAD_PUBLIC_BASE_URL) {
    return `${UPLOAD_PUBLIC_BASE_URL}${normalizedPath}`;
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  if (!host) return normalizedPath;

  return `${protocol}://${host}${normalizedPath}`;
}

async function getPublicGallery(req, res) {
  try {
    const images = await galleryService.getGalleryImages({
      ...req.query,
      active: req.query.active ?? true,
    });
    res.json(images);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getGalleryImageById(req, res) {
  try {
    const image = await galleryService.getGalleryImageById(req.params.id);
    res.json(image);
  } catch (err) {
    const status = err.message === "Gallery image not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function getGalleryAdmin(req, res) {
  try {
    const images = await galleryService.getGalleryImages(req.query);
    res.json(images);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function uploadGalleryImage(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        error: "image file is required (multipart field name: image)",
      });
    }

    const uploadedImage = await galleryService.saveUploadedGalleryImage(req.file.buffer);
    return res.status(201).json({
      imageUrl: buildPublicAssetUrl(req, uploadedImage.imagePath),
      thumbnailUrl: buildPublicAssetUrl(req, uploadedImage.thumbnailPath),
      width: uploadedImage.width,
      height: uploadedImage.height,
      sizeBytes: uploadedImage.sizeBytes,
      mimeType: uploadedImage.mimeType,
    });
  } catch (err) {
    return res.status(400).json({
      error: err?.message || "Error while uploading gallery image",
    });
  }
}

async function createGalleryImage(req, res) {
  try {
    const image = await galleryService.createGalleryImage(req.body);
    res.status(201).json(image);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateGalleryImage(req, res) {
  try {
    const image = await galleryService.updateGalleryImage(req.params.id, req.body);
    res.json(image);
  } catch (err) {
    const status = err.message === "Gallery image not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function activateGalleryImage(req, res) {
  try {
    const image = await galleryService.activateGalleryImage(
      req.params.id,
      req.body.active
    );
    res.json(image);
  } catch (err) {
    const status = err.message === "Gallery image not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function deleteGalleryImage(req, res) {
  try {
    await galleryService.deleteGalleryImage(req.params.id);
    res.json({ message: "Gallery image deleted" });
  } catch (err) {
    const status = err.message === "Gallery image not found" ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getPublicGallery,
  getGalleryImageById,
  getGalleryAdmin,
  uploadGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  activateGalleryImage,
  deleteGalleryImage,
};
