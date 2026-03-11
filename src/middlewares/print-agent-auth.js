const printService = require("../services/print.service");

function extractAgentToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const directHeader = req.headers["x-print-agent-token"];
  if (typeof directHeader === "string" && directHeader.trim()) {
    return directHeader.trim();
  }

  return "";
}

async function printAgentAuthMiddleware(req, res, next) {
  try {
    const agentCode = req.params.agentCode;
    const token = extractAgentToken(req);
    const agent = await printService.authenticatePrintAgent(agentCode, token);
    req.printAgent = agent;
    next();
  } catch (err) {
    const status = Number(err?.status) || 401;
    res.status(status).json({
      error: err?.message || "Unauthorized print agent",
      code: err?.code || "PRINT_AGENT_UNAUTHORIZED",
    });
  }
}

module.exports = {
  printAgentAuthMiddleware,
};
