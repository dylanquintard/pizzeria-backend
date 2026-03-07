const galleryService = require("../services/gallery.service");

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
  createGalleryImage,
  updateGalleryImage,
  activateGalleryImage,
  deleteGalleryImage,
};
