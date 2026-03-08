const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.post("/register", userController.register);
router.post("/verify-email", userController.verifyEmail);
router.post("/resend-verification", userController.resendEmailVerification);
router.post("/login", userController.login);
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
