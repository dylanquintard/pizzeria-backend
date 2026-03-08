const buckets = new Map();

function cleanupExpiredEntries(now) {
  for (const [key, value] of buckets.entries()) {
    if (value.expiresAt <= now) {
      buckets.delete(key);
    }
  }
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function buildLimiterKey(req, scope) {
  const ip = getClientIp(req);
  return `${scope}:${ip}`;
}

function createRateLimiter({
  scope,
  windowMs,
  maxRequests,
  keyBuilder,
  message = "Too many requests. Please try again later.",
} = {}) {
  if (!scope) {
    throw new Error("Rate limiter scope is required");
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("Rate limiter windowMs must be a positive integer");
  }
  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error("Rate limiter maxRequests must be a positive integer");
  }
  if (keyBuilder !== undefined && typeof keyBuilder !== "function") {
    throw new Error("Rate limiter keyBuilder must be a function when provided");
  }

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const key =
      typeof keyBuilder === "function"
        ? `${scope}:${String(keyBuilder(req) || "unknown")}`
        : buildLimiterKey(req, scope);
    const record = buckets.get(key);

    if (!record || record.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.expiresAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({ error: message });
    }

    record.count += 1;
    buckets.set(key, record);
    return next();
  };
}

module.exports = {
  createRateLimiter,
};
