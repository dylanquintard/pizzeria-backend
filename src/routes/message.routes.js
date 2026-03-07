const express = require("express");
const router = express.Router();
const messageController = require("../controllers/message.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

router.get("/threads/me", authMiddleware, messageController.getMyThreads);
router.post("/threads", authMiddleware, messageController.createThread);
router.get(
  "/threads/:threadId/messages",
  authMiddleware,
  messageController.getThreadMessages
);
router.post(
  "/threads/:threadId/messages",
  authMiddleware,
  messageController.addMessageToThread
);

router.get(
  "/admin/threads",
  authMiddleware,
  adminMiddleware,
  messageController.getAdminThreads
);
router.patch(
  "/admin/threads/:threadId/status",
  authMiddleware,
  adminMiddleware,
  messageController.updateThreadStatus
);
router.delete(
  "/admin/threads/:threadId",
  authMiddleware,
  adminMiddleware,
  messageController.deleteAdminThread
);

module.exports = router;
