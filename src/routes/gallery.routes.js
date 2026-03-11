const express = require("express");
const router = express.Router();
const galleryController = require("../controllers/gallery.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { handleGalleryImageUpload } = require("../middlewares/gallery-upload");

router.get("/", galleryController.getPublicGallery);
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  galleryController.getGalleryAdmin
);
router.post(
  "/upload",
  authMiddleware,
  adminMiddleware,
  handleGalleryImageUpload,
  galleryController.uploadGalleryImage
);
router.get("/:id", galleryController.getGalleryImageById);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  galleryController.createGalleryImage
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  galleryController.updateGalleryImage
);
router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  galleryController.activateGalleryImage
);
router.patch(
  "/:id/home-background",
  authMiddleware,
  adminMiddleware,
  galleryController.setGalleryHomeBackground
);
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  galleryController.deleteGalleryImage
);

module.exports = router;
