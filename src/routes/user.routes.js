const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { createRateLimiter } = require("../middlewares/rate-limit");

function normalizeEmailForKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "no-email";
}

function buildAuthKey(req) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown-ip";
  const email = normalizeEmailForKey(req.body?.email);
  return `${ip}:${email}`;
}

const authRegisterRateLimit = createRateLimiter({
  scope: "auth-register",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyBuilder: buildAuthKey,
});

const authLoginRateLimit = createRateLimiter({
  scope: "auth-login",
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyBuilder: buildAuthKey,
});

const authVerifyEmailRateLimit = createRateLimiter({
  scope: "auth-verify-email",
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  keyBuilder: buildAuthKey,
});

const authResendRateLimit = createRateLimiter({
  scope: "auth-resend-verification",
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  keyBuilder: buildAuthKey,
});

router.post("/register", authRegisterRateLimit, userController.register);
router.post("/verify-email", authVerifyEmailRateLimit, userController.verifyEmail);
router.post("/resend-verification", authResendRateLimit, userController.resendEmailVerification);
router.post("/login", authLoginRateLimit, userController.login);
router.post("/logout", authMiddleware, userController.logout);

router.get("/me", authMiddleware, userController.me);
router.put("/me", authMiddleware, userController.updateMe);
router.get("/orders", authMiddleware, userController.getUserOrders);

router.get("/", authMiddleware, adminMiddleware, userController.getAllUsers);
router.get("/:id", authMiddleware, adminMiddleware, userController.getUserById);
router.put(
  "/:id/role",
  authMiddleware,
  adminMiddleware,
  userController.adminUpdateUserRole
);
router.delete("/:id", authMiddleware, adminMiddleware, userController.adminDeleteUser);

module.exports = router;
