const multer = require("multer");
const { UPLOAD_MAX_MB } = require("../lib/env");

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_MAX_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Unsupported image type. Allowed: jpeg, png, webp"));
  },
});

function handleGalleryImageUpload(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: `Image too large. Max size is ${UPLOAD_MAX_MB}MB`,
        });
        return;
      }

      res.status(400).json({ error: err.message || "Invalid upload payload" });
      return;
    }

    res.status(400).json({ error: err.message || "Invalid upload payload" });
  });
}

module.exports = {
  handleGalleryImageUpload,
};
