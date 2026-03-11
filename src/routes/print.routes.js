const express = require("express");
const router = express.Router();
const printController = require("../controllers/print.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { printAgentAuthMiddleware } = require("../middlewares/print-agent-auth");

router.post(
  "/agents/:agentCode/heartbeat",
  printAgentAuthMiddleware,
  printController.heartbeat
);
router.post(
  "/agents/:agentCode/claim-next",
  printAgentAuthMiddleware,
  printController.claimNext
);
router.post(
  "/agents/:agentCode/jobs/:jobId/success",
  printAgentAuthMiddleware,
  printController.markJobSuccess
);
router.post(
  "/agents/:agentCode/jobs/:jobId/fail",
  printAgentAuthMiddleware,
  printController.markJobFail
);

router.get("/admin/jobs", authMiddleware, adminMiddleware, printController.getPrintJobsAdmin);
router.get("/admin/overview", authMiddleware, adminMiddleware, printController.getPrintOverviewAdmin);
router.post(
  "/admin/jobs/:jobId/reprint",
  authMiddleware,
  adminMiddleware,
  printController.reprintJobAdmin
);
router.post(
  "/admin/scheduler/tick",
  authMiddleware,
  adminMiddleware,
  printController.schedulerTickAdmin
);

router.get("/admin/agents", authMiddleware, adminMiddleware, printController.getAgentsAdmin);
router.post("/admin/agents", authMiddleware, adminMiddleware, printController.upsertAgentAdmin);
router.post(
  "/admin/agents/:agentCode/rotate-token",
  authMiddleware,
  adminMiddleware,
  printController.rotateAgentTokenAdmin
);
router.delete(
  "/admin/agents/:agentCode",
  authMiddleware,
  adminMiddleware,
  printController.deleteAgentAdmin
);

router.get("/admin/printers", authMiddleware, adminMiddleware, printController.getPrintersAdmin);
router.post(
  "/admin/printers",
  authMiddleware,
  adminMiddleware,
  printController.upsertPrinterAdmin
);
router.delete(
  "/admin/printers/:printerCode",
  authMiddleware,
  adminMiddleware,
  printController.deletePrinterAdmin
);

module.exports = router;
