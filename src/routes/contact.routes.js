const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contact.controller");
const { createRateLimiter } = require("../middlewares/rate-limit");

function normalizeEmailForKey(value) {
  return String(value || "").trim().toLowerCase() || "no-email";
}

function buildContactKey(req) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown-ip";
  const email = normalizeEmailForKey(req.body?.email);
  return `${ip}:${email}`;
}

const contactEmailRateLimit = createRateLimiter({
  scope: "contact-email",
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  keyBuilder: buildContactKey,
  message: "Too many contact requests. Please try again later.",
});

router.post("/email", contactEmailRateLimit, contactController.sendContactEmail);

module.exports = router;
