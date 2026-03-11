const crypto = require("crypto");
const {
  PrintAgentStatus,
  PrinterConnectionType,
  PrintJobStatus,
  PrintJobType,
  PrintLogLevel,
} = require("@prisma/client");
const prisma = require("../lib/prisma");
const {
  PRINT_SCHEDULER_ENABLED,
  PRINT_SCHEDULER_INTERVAL_MS,
  PRINT_JOB_LOCK_MS,
  PRINT_RETRY_BASE_SECONDS,
  PRINT_RETRY_MAX_SECONDS,
  PRINT_DEFAULT_MAX_ATTEMPTS,
} = require("../lib/env");
const { normalizeCustomizations } = require("../utils/customizations");
const { DELETED_PRODUCT_FALLBACK_NAME } = require("../utils/product");

const MIN_NOTE_LENGTH = 0;
const MAX_NOTE_LENGTH = 1000;
const CLAIM_RETRY_ATTEMPTS = 5;

const ORDER_TICKET_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  timeSlot: {
    include: {
      location: true,
    },
  },
  items: {
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  },
};

let schedulerTimer = null;

function createError(message, status = 400, code = "VALIDATION_ERROR") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toMoneyString(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
}

function normalizeOptionalText(value, fieldName, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw createError(`${fieldName} is too long`, 400, "INVALID_TEXT");
  }
  return normalized;
}

function normalizeRequiredText(value, fieldName, maxLength = 255) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw createError(`${fieldName} is required`, 400, "MISSING_FIELD");
  }
  if (normalized.length > maxLength) {
    throw createError(`${fieldName} is too long`, 400, "INVALID_TEXT");
  }
  return normalized;
}

function normalizeCode(value, fieldName) {
  const normalized = normalizeRequiredText(value, fieldName, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
    throw createError(`${fieldName} format is invalid`, 400, "INVALID_CODE");
  }
  return normalized;
}

function parseOptionalPositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(`${fieldName} must be a positive integer`, 400, "INVALID_NUMBER");
  }
  return parsed;
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(`${fieldName} must be a positive integer`, 400, "INVALID_NUMBER");
  }
  return parsed;
}

function parseBoundedInt(value, fieldName, min, max, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw createError(`${fieldName} must be an integer between ${min} and ${max}`, 400, "INVALID_NUMBER");
  }
  return parsed;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseDateOrNow(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createError("Invalid date value", 400, "INVALID_DATE");
  }
  return parsed;
}

function hashPrintAgentToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

function generatePrintAgentToken() {
  return `agt_${crypto.randomBytes(24).toString("hex")}`;
}

function safeHexCompare(leftHex, rightHex) {
  try {
    const left = Buffer.from(String(leftHex || ""), "hex");
    const right = Buffer.from(String(rightHex || ""), "hex");
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return false;
    }
    return crypto.timingSafeEqual(left, right);
  } catch (_err) {
    return false;
  }
}

function parsePrintAgentStatus(value, fallback = PrintAgentStatus.OFFLINE) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toUpperCase();
  if (!PrintAgentStatus[normalized]) {
    throw createError("Invalid print agent status", 400, "INVALID_STATUS");
  }
  return PrintAgentStatus[normalized];
}

function parsePrinterConnectionType(value, fallback = PrinterConnectionType.ETHERNET) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toUpperCase();
  if (!PrinterConnectionType[normalized]) {
    throw createError("Invalid printer connection type", 400, "INVALID_CONNECTION_TYPE");
  }
  return PrinterConnectionType[normalized];
}

function parsePrintJobStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!PrintJobStatus[normalized]) {
    throw createError("Invalid print job status", 400, "INVALID_STATUS");
  }
  return PrintJobStatus[normalized];
}

async function buildIngredientMapForOrder(client, order) {
  const ingredientIds = new Set();

  for (const item of order.items || []) {
    const custom = normalizeCustomizations(item.customizations || {});
    for (const id of custom.addedIngredients) ingredientIds.add(id);
    for (const id of custom.removedIngredients) ingredientIds.add(id);
  }

  if (ingredientIds.size === 0) return new Map();

  const ingredients = await client.ingredient.findMany({
    where: { id: { in: [...ingredientIds] } },
    select: { id: true, name: true },
  });

  return new Map(ingredients.map((entry) => [entry.id, entry.name]));
}

function computeScheduledAt(startTime, forceNow = false) {
  const now = new Date();
  if (forceNow) return now;

  const startDate = new Date(startTime);
  if (Number.isNaN(startDate.getTime())) {
    throw createError("Invalid order pickup time", 400, "INVALID_PICKUP_TIME");
  }

  const target = new Date(startDate.getTime() - 30 * 60_000);
  return target > now ? target : now;
}

function getAgentStatusWeight(status) {
  if (status === PrintAgentStatus.ONLINE) return 0;
  if (status === PrintAgentStatus.DEGRADED) return 1;
  if (status === PrintAgentStatus.OFFLINE) return 2;
  return 3;
}

function pickBestPrinter(printers) {
  const candidates = (Array.isArray(printers) ? printers : []).filter((entry) => entry?.isActive);
  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    const weightDiff = getAgentStatusWeight(left?.agent?.status) - getAgentStatusWeight(right?.agent?.status);
    if (weightDiff !== 0) return weightDiff;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  return candidates[0] || null;
}

async function findPrinterForOrder(client, locationId, forcedPrinterId = null) {
  if (forcedPrinterId) {
    return client.printer.findFirst({
      where: {
        id: parsePositiveInt(forcedPrinterId, "printerId"),
        isActive: true,
      },
    });
  }

  if (locationId) {
    const locationPrinters = await client.printer.findMany({
      where: {
        isActive: true,
        locationId,
      },
      include: {
        agent: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    const bestLocationPrinter = pickBestPrinter(locationPrinters);
    if (bestLocationPrinter) return bestLocationPrinter;
  }

  const globalPrinters = await client.printer.findMany({
    where: {
      isActive: true,
      locationId: null,
    },
    include: {
      agent: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });
  const bestGlobalPrinter = pickBestPrinter(globalPrinters);
  if (bestGlobalPrinter) return bestGlobalPrinter;

  // Safe fallback when only one printer exists in the whole fleet.
  const allActivePrinters = await client.printer.findMany({
    where: {
      isActive: true,
    },
    include: {
      agent: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (allActivePrinters.length === 1) {
    return allActivePrinters[0];
  }

  return null;
}

function createPrimaryIdempotencyKey(orderId, printerId) {
  return `order:${orderId}:printer:${printerId}:ticket:primary`;
}

function createReprintIdempotencyKey(sourceJobId) {
  return `reprint:${sourceJobId}:${Date.now()}:${crypto.randomUUID()}`;
}

function formatOrderItemTicket(item, ingredientMap) {
  const custom = normalizeCustomizations(item.customizations || {});

  const addedIngredients = custom.addedIngredients
    .map((id) => ingredientMap.get(id))
    .filter(Boolean);

  const removedIngredients = custom.removedIngredients
    .map((id) => ingredientMap.get(id))
    .filter(Boolean);

  const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);

  return {
    line_id: item.id,
    qty: Number(item.quantity || 0),
    name: item.product?.name || DELETED_PRODUCT_FALLBACK_NAME,
    unit_price: toMoneyString(item.unitPrice),
    line_total: toMoneyString(lineTotal),
    added_ingredients: addedIngredients,
    removed_ingredients: removedIngredients,
  };
}

function buildOrderTicketPayload({ order, printerCode, scheduledAt, ticketItems }) {
  const location = order.timeSlot?.location || null;
  const customerFirstName = order.user?.firstName || null;
  const customerLastName = order.user?.lastName || null;

  return {
    schema_version: "1.0",
    type: "order_ticket",
    job_id: null,
    printer_code: printerCode,
    created_at: new Date().toISOString(),
    scheduled_at: new Date(scheduledAt).toISOString(),
    order: {
      id: order.id,
      number: `A-${order.id}`,
      status: order.status,
      pickup_time: order.timeSlot?.startTime
        ? new Date(order.timeSlot.startTime).toISOString()
        : null,
      location: {
        name: location?.name || "",
        address: [location?.addressLine1, `${location?.postalCode || ""} ${location?.city || ""}`.trim()]
          .filter(Boolean)
          .join(", "),
      },
      customer: {
        first_name: customerFirstName,
        last_name: customerLastName,
        full_name: order.user?.name || "",
        phone: order.user?.phone || "",
      },
      note: order.customerNote || null,
      items: ticketItems,
      total: toMoneyString(order.total),
      currency: "EUR",
    },
  };
}

async function createPrintLog(client, data) {
  return client.printLog.create({
    data: {
      jobId: data.jobId || null,
      agentId: data.agentId || null,
      level: data.level || PrintLogLevel.INFO,
      event: data.event,
      payload: data.payload || null,
    },
  });
}

async function enqueueOrderTicketForOrderId(client, orderId, options = {}) {
  const parsedOrderId = parsePositiveInt(orderId, "orderId");
  const forceNow = parseBoolean(options.forceNow, false);
  const order = await client.order.findUnique({
    where: { id: parsedOrderId },
    include: ORDER_TICKET_INCLUDE,
  });

  if (!order) {
    throw createError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  if (!order.timeSlot?.startTime) {
    throw createError("Order has no pickup timeslot", 400, "ORDER_HAS_NO_TIMESLOT");
  }

  const note = normalizeOptionalText(
    order.customerNote,
    "customerNote",
    MAX_NOTE_LENGTH
  );

  if (note && note.length < MIN_NOTE_LENGTH) {
    throw createError("customerNote is invalid", 400, "INVALID_NOTE");
  }

  const printer = await findPrinterForOrder(
    client,
    order.timeSlot?.locationId || null,
    options.printerId || null
  );

  if (!printer) {
    return {
      created: false,
      reason: "NO_ACTIVE_PRINTER",
      job: null,
    };
  }

  const scheduledAt = computeScheduledAt(order.timeSlot.startTime, forceNow);
  const now = new Date();
  const initialStatus = scheduledAt <= now ? PrintJobStatus.READY : PrintJobStatus.PENDING;
  const priority = initialStatus === PrintJobStatus.READY ? 10 : 50;

  const ingredientMap = await buildIngredientMapForOrder(client, order);
  const ticketItems = (order.items || []).map((item) =>
    formatOrderItemTicket(item, ingredientMap)
  );

  const payload = buildOrderTicketPayload({
    order: { ...order, customerNote: note },
    printerCode: printer.code,
    scheduledAt,
    ticketItems,
  });

  if (options.reprintOfJobId) {
    payload.reprint = {
      source_job_id: options.reprintOfJobId,
      reason: normalizeOptionalText(options.reason, "reason", 255),
      created_at: now.toISOString(),
    };
  }

  const idempotencyKey = normalizeRequiredText(
    options.idempotencyKey ||
      (options.reprintOfJobId
        ? createReprintIdempotencyKey(options.reprintOfJobId)
        : createPrimaryIdempotencyKey(order.id, printer.id)),
    "idempotencyKey",
    255
  );

  try {
    let job = await client.printJob.create({
      data: {
        orderId: order.id,
        printerId: printer.id,
        jobType: PrintJobType.ORDER_TICKET,
        status: initialStatus,
        priority,
        scheduledAt,
        maxAttempts: PRINT_DEFAULT_MAX_ATTEMPTS,
        reprintOfJobId: options.reprintOfJobId || null,
        idempotencyKey,
        payload,
      },
    });

    job = await client.printJob.update({
      where: { id: job.id },
      data: {
        payload: {
          ...payload,
          job_id: job.id,
        },
      },
    });

    await createPrintLog(client, {
      jobId: job.id,
      level: PrintLogLevel.INFO,
      event: "print_job_created",
      payload: {
        orderId: order.id,
        printerCode: printer.code,
        status: job.status,
      },
    });

    return {
      created: true,
      reason: null,
      job,
    };
  } catch (err) {
    if (err?.code === "P2002") {
      const existingJob = await client.printJob.findUnique({
        where: { idempotencyKey },
      });
      if (existingJob) {
        return {
          created: false,
          reason: "IDEMPOTENT_ALREADY_EXISTS",
          job: existingJob,
        };
      }
    }
    throw err;
  }
}

async function authenticatePrintAgent(agentCode, rawToken) {
  const normalizedCode = normalizeCode(agentCode, "agentCode");
  const token = String(rawToken || "").trim();
  if (!token) {
    throw createError("Unauthorized print agent", 401, "PRINT_AGENT_UNAUTHORIZED");
  }

  const agent = await prisma.printAgent.findUnique({
    where: { code: normalizedCode },
  });

  if (!agent) {
    throw createError("Unauthorized print agent", 401, "PRINT_AGENT_UNAUTHORIZED");
  }

  const providedHash = hashPrintAgentToken(token);
  const isValid = safeHexCompare(agent.tokenHash, providedHash);
  if (!isValid) {
    throw createError("Unauthorized print agent", 401, "PRINT_AGENT_UNAUTHORIZED");
  }

  return agent;
}

async function getPrintAgents() {
  return prisma.printAgent.findMany({
    include: {
      printers: {
        include: {
          location: {
            select: {
              id: true,
              name: true,
              city: true,
              active: true,
            },
          },
        },
        orderBy: { code: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });
}

async function upsertPrintAgent(payload = {}) {
  const code = normalizeCode(payload.code, "code");
  const name = normalizeRequiredText(payload.name, "name", 120);
  const status = parsePrintAgentStatus(payload.status, PrintAgentStatus.OFFLINE);

  const existing = await prisma.printAgent.findUnique({ where: { code } });
  const providedToken = normalizeOptionalText(payload.token, "token", 512);
  let tokenToReturn = null;

  if (!existing) {
    const rawToken = providedToken || generatePrintAgentToken();
    tokenToReturn = rawToken;

    const created = await prisma.printAgent.create({
      data: {
        code,
        name,
        status,
        tokenHash: hashPrintAgentToken(rawToken),
        metadata: payload.metadata || null,
      },
    });

    return {
      agent: created,
      token: tokenToReturn,
    };
  }

  const updateData = {
    name,
    status,
  };

  if (payload.metadata !== undefined) {
    updateData.metadata = payload.metadata;
  }

  if (providedToken) {
    updateData.tokenHash = hashPrintAgentToken(providedToken);
    tokenToReturn = providedToken;
  }

  const updated = await prisma.printAgent.update({
    where: { id: existing.id },
    data: updateData,
  });

  return {
    agent: updated,
    token: tokenToReturn,
  };
}

async function rotatePrintAgentToken(agentCode) {
  const code = normalizeCode(agentCode, "agentCode");
  const existing = await prisma.printAgent.findUnique({ where: { code } });

  if (!existing) {
    throw createError("Print agent not found", 404, "PRINT_AGENT_NOT_FOUND");
  }

  const rawToken = generatePrintAgentToken();
  const updated = await prisma.printAgent.update({
    where: { id: existing.id },
    data: {
      tokenHash: hashPrintAgentToken(rawToken),
    },
  });

  return {
    agent: updated,
    token: rawToken,
  };
}

async function deletePrintAgent(agentCode) {
  const code = normalizeCode(agentCode, "agentCode");
  const existing = await prisma.printAgent.findUnique({ where: { code } });

  if (!existing) {
    throw createError("Print agent not found", 404, "PRINT_AGENT_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.printer.updateMany({
      where: { agentId: existing.id },
      data: { agentId: null },
    });
    await tx.printAgent.delete({
      where: { id: existing.id },
    });
  });

  return {
    ok: true,
    deletedCode: code,
  };
}

async function getPrinters() {
  return prisma.printer.findMany({
    include: {
      agent: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          lastHeartbeatAt: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          postalCode: true,
          city: true,
          active: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

async function upsertPrinter(payload = {}) {
  const code = normalizeCode(payload.code, "code");
  const name = normalizeRequiredText(payload.name, "name", 120);
  const model = normalizeOptionalText(payload.model, "model", 120);
  const paperWidthMm = parseBoundedInt(payload.paperWidthMm, "paperWidthMm", 58, 80, 80);
  const connectionType = parsePrinterConnectionType(payload.connectionType, PrinterConnectionType.ETHERNET);
  const ipAddress = normalizeOptionalText(payload.ipAddress, "ipAddress", 120);
  const port = parseBoundedInt(payload.port, "port", 1, 65535, 9100);
  const isActive = parseBoolean(payload.isActive, true);
  const locationId = parseOptionalPositiveInt(payload.locationId, "locationId");
  const agentCode = payload.agentCode ? normalizeCode(payload.agentCode, "agentCode") : null;

  let agentId = null;
  if (agentCode) {
    const agent = await prisma.printAgent.findUnique({ where: { code: agentCode } });
    if (!agent) {
      throw createError("Print agent not found", 404, "PRINT_AGENT_NOT_FOUND");
    }
    agentId = agent.id;
  }

  if (locationId) {
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw createError("Location not found", 404, "LOCATION_NOT_FOUND");
    }
  }

  const existing = await prisma.printer.findUnique({ where: { code } });

  if (!existing) {
    return prisma.printer.create({
      data: {
        code,
        name,
        model,
        paperWidthMm,
        connectionType,
        ipAddress,
        port,
        isActive,
        agentId,
        locationId,
      },
    });
  }

  return prisma.printer.update({
    where: { id: existing.id },
    data: {
      name,
      model,
      paperWidthMm,
      connectionType,
      ipAddress,
      port,
      isActive,
      agentId,
      locationId,
    },
  });
}

async function deletePrinter(printerCode) {
  const code = normalizeCode(printerCode, "printerCode");
  const existing = await prisma.printer.findUnique({ where: { code } });

  if (!existing) {
    throw createError("Printer not found", 404, "PRINTER_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.printJob.updateMany({
      where: {
        printerId: existing.id,
        status: {
          in: [
            PrintJobStatus.PENDING,
            PrintJobStatus.READY,
            PrintJobStatus.CLAIMED,
            PrintJobStatus.PRINTING,
            PrintJobStatus.RETRY_WAITING,
          ],
        },
      },
      data: {
        status: PrintJobStatus.CANCELLED,
        cancelledAt: new Date(),
        lastErrorCode: "PRINTER_REMOVED",
        lastErrorMessage: "Printer removed by admin",
      },
    });

    await tx.printer.delete({
      where: { id: existing.id },
    });
  });

  return {
    ok: true,
    deletedCode: code,
  };
}

async function updatePrintAgentHeartbeat(agent, heartbeatPayload = {}, requestIp = null) {
  const printers = Array.isArray(heartbeatPayload.printers)
    ? heartbeatPayload.printers
    : [];

  const hasPrinterIssue = printers.some(
    (entry) => entry && (entry.online === false || entry.paper_ok === false)
  );

  const nextStatus = hasPrinterIssue
    ? PrintAgentStatus.DEGRADED
    : PrintAgentStatus.ONLINE;

  const updatedAgent = await prisma.printAgent.update({
    where: { id: agent.id },
    data: {
      status: nextStatus,
      lastHeartbeatAt: new Date(),
      lastSeenIp: normalizeOptionalText(requestIp, "lastSeenIp", 120),
      version: normalizeOptionalText(heartbeatPayload.version, "version", 64),
      metadata: {
        internet_ok: Boolean(heartbeatPayload.internet_ok),
        printers,
      },
    },
  });

  await createPrintLog(prisma, {
    agentId: updatedAgent.id,
    level: PrintLogLevel.INFO,
    event: "agent_heartbeat",
    payload: {
      status: nextStatus,
      printersCount: printers.length,
    },
  });

  return {
    ok: true,
    server_time: new Date().toISOString(),
    agent: updatedAgent,
  };
}

async function claimNextPrintJob(agent, payload = {}) {
  const printerCode = normalizeCode(payload.printer_code || payload.printerCode, "printerCode");

  const printer = await prisma.printer.findFirst({
    where: {
      code: printerCode,
      isActive: true,
      OR: [{ agentId: null }, { agentId: agent.id }],
    },
  });

  if (!printer) {
    throw createError("Printer not available for this agent", 404, "PRINTER_NOT_AVAILABLE");
  }

  for (let attempt = 0; attempt < CLAIM_RETRY_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const claimed = await prisma.$transaction(async (tx) => {
      const candidate = await tx.printJob.findFirst({
        where: {
          printerId: printer.id,
          status: PrintJobStatus.READY,
          cancelledAt: null,
          scheduledAt: { lte: new Date() },
        },
        orderBy: [
          { priority: "asc" },
          { scheduledAt: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (!candidate) return null;

      const claimToken = crypto.randomUUID();
      const lockUntil = new Date(Date.now() + PRINT_JOB_LOCK_MS);
      const updateResult = await tx.printJob.updateMany({
        where: {
          id: candidate.id,
          status: PrintJobStatus.READY,
        },
        data: {
          status: PrintJobStatus.CLAIMED,
          claimedAt: new Date(),
          claimedByAgentId: agent.id,
          claimToken,
          lockedUntil: lockUntil,
          attemptCount: {
            increment: 1,
          },
        },
      });

      if (updateResult.count !== 1) {
        return "RETRY";
      }

      const job = await tx.printJob.findUnique({
        where: { id: candidate.id },
      });

      await tx.printJobAttempt.create({
        data: {
          jobId: candidate.id,
          agentId: agent.id,
          startedAt: new Date(),
        },
      });

      await createPrintLog(tx, {
        jobId: candidate.id,
        agentId: agent.id,
        level: PrintLogLevel.INFO,
        event: "print_job_claimed",
        payload: {
          printerCode,
          lockedUntil: lockUntil.toISOString(),
        },
      });

      return {
        job,
        claimToken,
      };
    });

    if (!claimed) {
      return null;
    }

    if (claimed === "RETRY") {
      // eslint-disable-next-line no-continue
      continue;
    }

    return {
      id: claimed.job.id,
      claim_token: claimed.claimToken,
      locked_until: claimed.job.lockedUntil,
      attempt_count: claimed.job.attemptCount,
      payload: claimed.job.payload,
    };
  }

  return null;
}

async function markPrintJobSuccess(agent, jobId, payload = {}) {
  const printJobId = normalizeRequiredText(jobId, "jobId", 128);
  const claimToken = normalizeRequiredText(payload.claim_token || payload.claimToken, "claimToken", 128);
  const printedAt = parseDateOrNow(payload.printed_at || payload.printedAt);

  return prisma.$transaction(async (tx) => {
    const job = await tx.printJob.findUnique({ where: { id: printJobId } });
    if (!job) {
      throw createError("Print job not found", 404, "PRINT_JOB_NOT_FOUND");
    }

    if (job.claimedByAgentId !== agent.id || job.claimToken !== claimToken) {
      throw createError("Invalid claim token", 409, "INVALID_CLAIM_TOKEN");
    }

    if (![PrintJobStatus.CLAIMED, PrintJobStatus.PRINTING].includes(job.status)) {
      throw createError("Print job is not claimable", 409, "PRINT_JOB_INVALID_STATE");
    }

    const updated = await tx.printJob.update({
      where: { id: printJobId },
      data: {
        status: PrintJobStatus.PRINTED,
        printedAt,
        lockedUntil: null,
      },
    });

    await tx.printJobAttempt.updateMany({
      where: {
        jobId: printJobId,
        agentId: agent.id,
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
        success: true,
        printerResponse: payload.meta || null,
      },
    });

    await createPrintLog(tx, {
      jobId: printJobId,
      agentId: agent.id,
      level: PrintLogLevel.INFO,
      event: "print_job_printed",
      payload: payload.meta || null,
    });

    return {
      ok: true,
      status: updated.status,
    };
  });
}

function computeRetryDelaySeconds(attemptCount) {
  const exponent = Math.max(0, Number(attemptCount || 1) - 1);
  const delay = PRINT_RETRY_BASE_SECONDS * (2 ** exponent);
  return Math.min(PRINT_RETRY_MAX_SECONDS, delay);
}

async function markPrintJobFailure(agent, jobId, payload = {}) {
  const printJobId = normalizeRequiredText(jobId, "jobId", 128);
  const claimToken = normalizeRequiredText(payload.claim_token || payload.claimToken, "claimToken", 128);
  const errorCode = normalizeOptionalText(payload.error_code || payload.errorCode, "errorCode", 120) || "PRINT_ERROR";
  const errorMessage = normalizeOptionalText(payload.error_message || payload.errorMessage, "errorMessage", 500) || "Unknown print error";
  const retryable = parseBoolean(payload.retryable, true);

  return prisma.$transaction(async (tx) => {
    const job = await tx.printJob.findUnique({ where: { id: printJobId } });
    if (!job) {
      throw createError("Print job not found", 404, "PRINT_JOB_NOT_FOUND");
    }

    if (job.claimedByAgentId !== agent.id || job.claimToken !== claimToken) {
      throw createError("Invalid claim token", 409, "INVALID_CLAIM_TOKEN");
    }

    if (![PrintJobStatus.CLAIMED, PrintJobStatus.PRINTING].includes(job.status)) {
      throw createError("Print job is not claimable", 409, "PRINT_JOB_INVALID_STATE");
    }

    const shouldRetry = retryable && job.attemptCount < job.maxAttempts;
    const nextStatus = shouldRetry ? PrintJobStatus.RETRY_WAITING : PrintJobStatus.FAILED;
    const retryDelaySeconds = shouldRetry ? computeRetryDelaySeconds(job.attemptCount) : null;
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + retryDelaySeconds * 1000)
      : null;

    const updated = await tx.printJob.update({
      where: { id: printJobId },
      data: {
        status: nextStatus,
        nextRetryAt,
        failedAt: shouldRetry ? null : new Date(),
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        claimedByAgentId: null,
        claimToken: null,
        lockedUntil: null,
      },
    });

    await tx.printJobAttempt.updateMany({
      where: {
        jobId: printJobId,
        agentId: agent.id,
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
        success: false,
        errorCode,
        errorMessage,
        printerResponse: payload.meta || null,
      },
    });

    await createPrintLog(tx, {
      jobId: printJobId,
      agentId: agent.id,
      level: PrintLogLevel.WARN,
      event: "print_job_failed",
      payload: {
        errorCode,
        errorMessage,
        retryable: shouldRetry,
        nextRetryAt: nextRetryAt ? nextRetryAt.toISOString() : null,
      },
    });

    return {
      ok: true,
      status: updated.status,
      next_retry_at: nextRetryAt,
      attempt_count: updated.attemptCount,
    };
  });
}

async function getPrintJobs(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = parsePrintJobStatus(filters.status);
  }

  if (filters.orderId) {
    where.orderId = parsePositiveInt(filters.orderId, "orderId");
  }

  if (filters.date) {
    const start = new Date(filters.date);
    if (Number.isNaN(start.getTime())) {
      throw createError("Invalid date", 400, "INVALID_DATE");
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    where.scheduledAt = {
      gte: start,
      lte: end,
    };
  }

  const limit = parseBoundedInt(filters.limit, "limit", 1, 500, 100);

  return prisma.printJob.findMany({
    where,
    include: {
      order: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          timeSlot: {
            include: {
              location: true,
            },
          },
        },
      },
      printer: true,
      claimedByAgent: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });
}

async function getPrintOverview(filters = {}) {
  const heartbeatStaleMinutes = parseBoundedInt(
    filters.heartbeatStaleMinutes,
    "heartbeatStaleMinutes",
    1,
    120,
    3
  );

  const now = new Date();
  const staleBefore = new Date(now.getTime() - heartbeatStaleMinutes * 60_000);
  const failedSince = new Date(now.getTime() - 24 * 60 * 60_000);

  const [jobGroups, failedLast24h, agents, printers] = await Promise.all([
    prisma.printJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.printJob.count({
      where: {
        status: PrintJobStatus.FAILED,
        updatedAt: { gte: failedSince },
      },
    }),
    prisma.printAgent.findMany({
      include: {
        printers: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
          orderBy: { code: "asc" },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.printer.findMany({
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            lastHeartbeatAt: true,
          },
        },
      },
      orderBy: { code: "asc" },
    }),
  ]);

  const jobsByStatus = Object.values(PrintJobStatus).reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  for (const group of jobGroups) {
    jobsByStatus[group.status] = group?._count?._all || 0;
  }

  const agentAlerts = [];
  const printerAlerts = [];

  for (const agent of agents) {
    const staleHeartbeat = !agent.lastHeartbeatAt || agent.lastHeartbeatAt < staleBefore;
    const statusIssue = [PrintAgentStatus.DEGRADED, PrintAgentStatus.OFFLINE].includes(agent.status);
    const metadataPrinters = Array.isArray(agent?.metadata?.printers) ? agent.metadata.printers : [];

    if (statusIssue || staleHeartbeat) {
      agentAlerts.push({
        code: agent.code,
        name: agent.name,
        status: agent.status,
        lastHeartbeatAt: agent.lastHeartbeatAt,
        staleHeartbeat,
      });
    }

    for (const entry of metadataPrinters) {
      if (!entry || typeof entry !== "object") continue;
      const online = entry.online !== false;
      const paperOk = entry.paper_ok !== false;
      if (!online || !paperOk) {
        printerAlerts.push({
          agentCode: agent.code,
          printerCode: String(entry.code || "").trim() || null,
          online,
          paperOk,
        });
      }
    }
  }

  const inactivePrinters = printers.filter((printer) => printer.isActive === false).map((printer) => ({
    code: printer.code,
    name: printer.name,
    isActive: printer.isActive,
    agentCode: printer.agent?.code || null,
  }));

  return {
    generatedAt: now.toISOString(),
    heartbeatStaleMinutes,
    jobs: {
      total: Object.values(jobsByStatus).reduce((sum, value) => sum + Number(value || 0), 0),
      byStatus: jobsByStatus,
      failedLast24h,
    },
    agents: {
      total: agents.length,
      online: agents.filter((agent) => agent.status === PrintAgentStatus.ONLINE).length,
      degraded: agents.filter((agent) => agent.status === PrintAgentStatus.DEGRADED).length,
      offline: agents.filter((agent) => agent.status === PrintAgentStatus.OFFLINE).length,
      alerts: agentAlerts,
    },
    printers: {
      total: printers.length,
      active: printers.filter((printer) => printer.isActive).length,
      inactive: inactivePrinters.length,
      alerts: {
        metadataIssues: printerAlerts,
        inactive: inactivePrinters,
      },
    },
  };
}

async function reprintJob(jobId, payload = {}) {
  const sourceJobId = normalizeRequiredText(jobId, "jobId", 128);
  const copies = parseBoundedInt(payload.copies, "copies", 1, 5, 1);
  const reason = normalizeOptionalText(payload.reason, "reason", 255);

  return prisma.$transaction(async (tx) => {
    const sourceJob = await tx.printJob.findUnique({
      where: { id: sourceJobId },
    });

    if (!sourceJob) {
      throw createError("Print job not found", 404, "PRINT_JOB_NOT_FOUND");
    }

    const createdJobs = [];
    for (let index = 0; index < copies; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const created = await enqueueOrderTicketForOrderId(tx, sourceJob.orderId, {
        forceNow: true,
        printerId: sourceJob.printerId,
        reprintOfJobId: sourceJob.id,
        reason,
        idempotencyKey: createReprintIdempotencyKey(sourceJob.id),
      });
      if (created?.job) {
        createdJobs.push(created.job);
      }
    }

    return {
      ok: true,
      sourceJobId: sourceJob.id,
      jobs: createdJobs,
    };
  });
}

async function runPrintSchedulerTick() {
  const now = new Date();

  const pendingToReady = await prisma.printJob.updateMany({
    where: {
      status: PrintJobStatus.PENDING,
      scheduledAt: { lte: now },
      cancelledAt: null,
    },
    data: {
      status: PrintJobStatus.READY,
    },
  });

  const retryToReady = await prisma.printJob.updateMany({
    where: {
      status: PrintJobStatus.RETRY_WAITING,
      nextRetryAt: { lte: now },
      cancelledAt: null,
    },
    data: {
      status: PrintJobStatus.READY,
      nextRetryAt: null,
    },
  });

  const reclaimStale = await prisma.printJob.updateMany({
    where: {
      status: { in: [PrintJobStatus.CLAIMED, PrintJobStatus.PRINTING] },
      lockedUntil: { lt: now },
      cancelledAt: null,
    },
    data: {
      status: PrintJobStatus.RETRY_WAITING,
      nextRetryAt: now,
      claimedByAgentId: null,
      claimToken: null,
      lockedUntil: null,
      lastErrorCode: "CLAIM_TIMEOUT",
      lastErrorMessage: "Claim expired before print acknowledgement",
    },
  });

  return {
    pending_to_ready: pendingToReady.count,
    retry_to_ready: retryToReady.count,
    stale_reclaimed: reclaimStale.count,
  };
}

function startPrintScheduler() {
  if (!PRINT_SCHEDULER_ENABLED) {
    return false;
  }

  if (schedulerTimer) {
    return true;
  }

  schedulerTimer = setInterval(() => {
    runPrintSchedulerTick().catch((err) => {
      console.error("print scheduler tick error:", err);
    });
  }, PRINT_SCHEDULER_INTERVAL_MS);

  if (typeof schedulerTimer.unref === "function") {
    schedulerTimer.unref();
  }

  return true;
}

function stopPrintScheduler() {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}

module.exports = {
  hashPrintAgentToken,
  generatePrintAgentToken,
  authenticatePrintAgent,
  getPrintAgents,
  upsertPrintAgent,
  rotatePrintAgentToken,
  deletePrintAgent,
  getPrinters,
  upsertPrinter,
  deletePrinter,
  updatePrintAgentHeartbeat,
  claimNextPrintJob,
  markPrintJobSuccess,
  markPrintJobFailure,
  getPrintJobs,
  getPrintOverview,
  reprintJob,
  enqueueOrderTicketForOrderId,
  runPrintSchedulerTick,
  startPrintScheduler,
  stopPrintScheduler,
};
