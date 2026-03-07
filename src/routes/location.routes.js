const express = require("express");
const router = express.Router();
const locationController = require("../controllers/location.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/", locationController.getLocations);
router.get("/:id", locationController.getLocationById);

router.post("/", authMiddleware, adminMiddleware, locationController.createLocation);
router.put("/:id", authMiddleware, adminMiddleware, locationController.updateLocation);
router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  locationController.activateLocation
);
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  locationController.deleteLocation
);

module.exports = router;
