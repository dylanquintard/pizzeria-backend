const express = require("express");
const reviewController = require("../controllers/review.controller");

const router = express.Router();

router.get("/public", reviewController.getPublicReviews);

module.exports = router;
