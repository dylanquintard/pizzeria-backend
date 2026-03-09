const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isSafeMethod(method) {
  const normalizedMethod = String(method || "").trim().toUpperCase();
  return SAFE_METHODS.has(normalizedMethod);
}

function extractOriginFromReferer(referer) {
  const raw = String(referer || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch (_err) {
    return "";
  }
}

function getRequestOrigin(req) {
  const host = String(req.headers.host || "").trim();
  if (!host) return "";

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").trim().toLowerCase();
  const protocol = forwardedProto || (req.secure ? "https" : "http");
  return `${protocol}://${host}`;
}

function createOriginGuard({ normalizeOrigin, isAllowedOrigin }) {
  return (req, res, next) => {
    if (isSafeMethod(req.method)) return next();

    const directOrigin = normalizeOrigin(req.headers.origin);
    const refererOrigin = normalizeOrigin(extractOriginFromReferer(req.headers.referer));
    const requestOrigin = normalizeOrigin(getRequestOrigin(req));

    if (directOrigin) {
      if (directOrigin === requestOrigin || isAllowedOrigin(directOrigin)) {
        return next();
      }
      return res.status(403).json({ error: "Origin denied" });
    }

    if (refererOrigin) {
      if (refererOrigin === requestOrigin || isAllowedOrigin(refererOrigin)) {
        return next();
      }
      return res.status(403).json({ error: "Referer denied" });
    }

    return next();
  };
}

function readHeaderValue(req, headerName) {
  const value = req.headers[String(headerName || "").toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function validateCsrfTokenPair({
  method,
  csrfCookieToken,
  csrfHeaderToken,
}) {
  if (isSafeMethod(method)) return true;

  const cookieToken = String(csrfCookieToken || "").trim();
  const headerToken = String(csrfHeaderToken || "").trim();

  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}

module.exports = {
  SAFE_METHODS,
  isSafeMethod,
  extractOriginFromReferer,
  getRequestOrigin,
  createOriginGuard,
  readHeaderValue,
  validateCsrfTokenPair,
};
