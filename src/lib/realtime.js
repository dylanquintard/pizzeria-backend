const clients = new Set();
let nextClientId = 1;
let heartbeatTimer = null;

const HEARTBEAT_INTERVAL_MS = 25_000;
const DEFAULT_RETRY_MS = 5_000;

function normalizeStringSet(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  return normalized.length > 0 ? new Set(normalized) : null;
}

function cleanupClient(client) {
  if (!clients.has(client)) return;
  clients.delete(client);

  if (clients.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function safeWrite(response, payload) {
  try {
    response.write(payload);
    return true;
  } catch (_err) {
    return false;
  }
}

function writeEvent(response, eventName, data) {
  if (!safeWrite(response, `event: ${eventName}\n`)) return false;
  if (!safeWrite(response, `data: ${JSON.stringify(data)}\n\n`)) return false;
  return true;
}

function ensureHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    for (const client of clients) {
      const ok = safeWrite(client.response, ": heartbeat\n\n");
      if (!ok) {
        cleanupClient(client);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  if (typeof heartbeatTimer.unref === "function") {
    heartbeatTimer.unref();
  }
}

function registerRealtimeClient(req, res) {
  const userId = String(req.user?.userId || "");
  const role = String(req.user?.role || "").trim().toUpperCase();

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  safeWrite(res, `retry: ${DEFAULT_RETRY_MS}\n\n`);

  const client = {
    id: nextClientId++,
    userId,
    role,
    response: res,
  };

  clients.add(client);
  ensureHeartbeat();

  writeEvent(res, "realtime:connected", {
    userId,
    role,
    connectedAt: new Date().toISOString(),
  });

  let cleaned = false;
  const release = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupClient(client);
  };

  req.on("close", release);
  req.on("aborted", release);
  res.on("close", release);
}

function clientMatchesTarget(client, targets = {}) {
  const allowedRoles = normalizeStringSet(targets.roles);
  const allowedUsers = normalizeStringSet(targets.userIds);

  if (allowedRoles && !allowedRoles.has(client.role)) return false;
  if (allowedUsers && !allowedUsers.has(client.userId)) return false;
  return true;
}

function emitRealtimeEvent(eventName, payload = {}, targets = {}) {
  for (const client of clients) {
    if (!clientMatchesTarget(client, targets)) {
      continue;
    }

    const ok = writeEvent(client.response, eventName, {
      ...payload,
      event: eventName,
      sentAt: new Date().toISOString(),
    });

    if (!ok) {
      cleanupClient(client);
    }
  }
}

module.exports = {
  registerRealtimeClient,
  emitRealtimeEvent,
};
