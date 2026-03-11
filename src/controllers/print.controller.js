const printService = require("../services/print.service");

function sendError(res, err, fallbackStatus = 400) {
  const status = Number(err?.status) || fallbackStatus;
  res.status(status).json({
    error: err?.message || "Unexpected error",
    code: err?.code || "PRINT_ERROR",
  });
}

async function heartbeat(req, res) {
  try {
    const response = await printService.updatePrintAgentHeartbeat(
      req.printAgent,
      req.body || {},
      req.ip || req.socket?.remoteAddress || null
    );
    res.json(response);
  } catch (err) {
    sendError(res, err);
  }
}

async function claimNext(req, res) {
  try {
    const job = await printService.claimNextPrintJob(req.printAgent, req.body || {});
    if (!job) {
      res.status(204).send();
      return;
    }
    res.json({ job });
  } catch (err) {
    sendError(res, err);
  }
}

async function markJobSuccess(req, res) {
  try {
    const result = await printService.markPrintJobSuccess(
      req.printAgent,
      req.params.jobId,
      req.body || {}
    );
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function markJobFail(req, res) {
  try {
    const result = await printService.markPrintJobFailure(
      req.printAgent,
      req.params.jobId,
      req.body || {}
    );
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function getPrintJobsAdmin(req, res) {
  try {
    const jobs = await printService.getPrintJobs(req.query || {});
    res.json(jobs);
  } catch (err) {
    sendError(res, err);
  }
}

async function reprintJobAdmin(req, res) {
  try {
    const result = await printService.reprintJob(req.params.jobId, req.body || {});
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function getAgentsAdmin(_req, res) {
  try {
    const agents = await printService.getPrintAgents();
    res.json(agents);
  } catch (err) {
    sendError(res, err, 500);
  }
}

async function upsertAgentAdmin(req, res) {
  try {
    const result = await printService.upsertPrintAgent(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function rotateAgentTokenAdmin(req, res) {
  try {
    const result = await printService.rotatePrintAgentToken(req.params.agentCode);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function getPrintersAdmin(_req, res) {
  try {
    const printers = await printService.getPrinters();
    res.json(printers);
  } catch (err) {
    sendError(res, err, 500);
  }
}

async function upsertPrinterAdmin(req, res) {
  try {
    const printer = await printService.upsertPrinter(req.body || {});
    res.status(201).json(printer);
  } catch (err) {
    sendError(res, err);
  }
}

async function schedulerTickAdmin(_req, res) {
  try {
    const result = await printService.runPrintSchedulerTick();
    res.json(result);
  } catch (err) {
    sendError(res, err, 500);
  }
}

module.exports = {
  heartbeat,
  claimNext,
  markJobSuccess,
  markJobFail,
  getPrintJobsAdmin,
  reprintJobAdmin,
  getAgentsAdmin,
  upsertAgentAdmin,
  rotateAgentTokenAdmin,
  getPrintersAdmin,
  upsertPrinterAdmin,
  schedulerTickAdmin,
};
