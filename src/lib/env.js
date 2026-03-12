const path = require("path");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseBooleanFlag(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parsePositiveInt(value, fieldName, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseNodeEnv(value) {
  const normalized = String(value || "development").trim().toLowerCase();
  if (!["development", "test", "production"].includes(normalized)) {
    throw new Error("NODE_ENV must be one of: development, test, production");
  }
  return normalized;
}

function parseSameSite(value, defaultValue) {
  const normalized = String(value || defaultValue || "").trim().toLowerCase();
  if (!["lax", "strict", "none"].includes(normalized)) {
    throw new Error("AUTH_COOKIE_SAMESITE must be one of: lax, strict, none");
  }
  return normalized;
}

function parseCookieName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("AUTH_COOKIE_NAME must not be empty");
  }
  return normalized;
}

function parseHeaderName(value, fallback) {
  const normalized = String(value || fallback || "").trim().toLowerCase();
  if (!normalized) {
    throw new Error("CSRF_HEADER_NAME must not be empty");
  }
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error("CSRF_HEADER_NAME contains invalid characters");
  }
  return normalized;
}

function parseOptionalHttpUrl(value, fieldName) {
  if (value === undefined || value === null || value === "") return "";
  const normalized = normalizeOrigin(value);
  if (!/^https?:\/\/.+/i.test(normalized)) {
    throw new Error(`${fieldName} must be a valid http(s) URL`);
  }
  return normalized;
}

function assertJwtSecretStrength(secret) {
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
}

const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
const JWT_SECRET = getRequiredEnv("JWT_SECRET");
assertJwtSecretStrength(JWT_SECRET);

const PORT = Number(process.env.PORT) || 5000;
const TRUST_PROXY = parseBooleanFlag(process.env.TRUST_PROXY, NODE_ENV === "production");
const ENABLE_HSTS = parseBooleanFlag(process.env.ENABLE_HSTS, NODE_ENV === "production");
const HSTS_MAX_AGE = parsePositiveInt(process.env.HSTS_MAX_AGE, "HSTS_MAX_AGE", 31536000);
const AUTH_COOKIE_NAME = parseCookieName(process.env.AUTH_COOKIE_NAME || "pizzeria_auth");
const CSRF_COOKIE_NAME = parseCookieName(process.env.CSRF_COOKIE_NAME || "pizzeria_csrf");
const CSRF_HEADER_NAME = parseHeaderName(process.env.CSRF_HEADER_NAME, "x-csrf-token");
const AUTH_COOKIE_SECURE = parseBooleanFlag(process.env.AUTH_COOKIE_SECURE, NODE_ENV === "production");
const AUTH_COOKIE_SAMESITE = parseSameSite(
  process.env.AUTH_COOKIE_SAMESITE,
  NODE_ENV === "production" ? "none" : "lax"
);
const AUTH_COOKIE_MAX_AGE = parsePositiveInt(
  process.env.AUTH_COOKIE_MAX_AGE,
  "AUTH_COOKIE_MAX_AGE",
  7 * 24 * 60 * 60 * 1000
);
const UPLOAD_DIR = path.resolve(
  String(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")).trim()
);
const UPLOAD_MAX_MB = parsePositiveInt(process.env.UPLOAD_MAX_MB, "UPLOAD_MAX_MB", 5);
const UPLOAD_PUBLIC_BASE_URL = parseOptionalHttpUrl(
  process.env.UPLOAD_PUBLIC_BASE_URL,
  "UPLOAD_PUBLIC_BASE_URL"
);
const PRINT_SCHEDULER_ENABLED = parseBooleanFlag(process.env.PRINT_SCHEDULER_ENABLED, true);
const PRINT_SCHEDULER_INTERVAL_MS = parsePositiveInt(
  process.env.PRINT_SCHEDULER_INTERVAL_MS,
  "PRINT_SCHEDULER_INTERVAL_MS",
  2_000
);
const PRINT_JOB_LOCK_MS = parsePositiveInt(
  process.env.PRINT_JOB_LOCK_MS,
  "PRINT_JOB_LOCK_MS",
  60_000
);
const PRINT_RETRY_BASE_SECONDS = parsePositiveInt(
  process.env.PRINT_RETRY_BASE_SECONDS,
  "PRINT_RETRY_BASE_SECONDS",
  5
);
const PRINT_RETRY_MAX_SECONDS = parsePositiveInt(
  process.env.PRINT_RETRY_MAX_SECONDS,
  "PRINT_RETRY_MAX_SECONDS",
  300
);
const PRINT_DEFAULT_MAX_ATTEMPTS = parsePositiveInt(
  process.env.PRINT_DEFAULT_MAX_ATTEMPTS,
  "PRINT_DEFAULT_MAX_ATTEMPTS",
  5
);
const PRINT_AGENT_OFFLINE_AFTER_MS = parsePositiveInt(
  process.env.PRINT_AGENT_OFFLINE_AFTER_MS,
  "PRINT_AGENT_OFFLINE_AFTER_MS",
  30_000
);
const PRINT_JOB_RETENTION_HOURS = parsePositiveInt(
  process.env.PRINT_JOB_RETENTION_HOURS,
  "PRINT_JOB_RETENTION_HOURS",
  24
);
const PRINT_JOB_CLEANUP_INTERVAL_MS = parsePositiveInt(
  process.env.PRINT_JOB_CLEANUP_INTERVAL_MS,
  "PRINT_JOB_CLEANUP_INTERVAL_MS",
  60_000
);
const PRINT_READY_ALERT_AFTER_MINUTES = parsePositiveInt(
  process.env.PRINT_READY_ALERT_AFTER_MINUTES,
  "PRINT_READY_ALERT_AFTER_MINUTES",
  10
);
const PRINT_READY_FAIL_AFTER_MINUTES = parsePositiveInt(
  process.env.PRINT_READY_FAIL_AFTER_MINUTES,
  "PRINT_READY_FAIL_AFTER_MINUTES",
  10
);
const PRINT_REPRINT_READY_FAIL_AFTER_MINUTES = parsePositiveInt(
  process.env.PRINT_REPRINT_READY_FAIL_AFTER_MINUTES,
  "PRINT_REPRINT_READY_FAIL_AFTER_MINUTES",
  10
);

if (PRINT_READY_FAIL_AFTER_MINUTES < PRINT_READY_ALERT_AFTER_MINUTES) {
  throw new Error("PRINT_READY_FAIL_AFTER_MINUTES must be >= PRINT_READY_ALERT_AFTER_MINUTES");
}

if (AUTH_COOKIE_SAMESITE === "none" && !AUTH_COOKIE_SECURE) {
  throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is 'none'");
}
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "https://pizzeria-front-dqty.onrender.com,http://localhost:3000/")
  .split(",")
  .map((item) => normalizeOrigin(item))
  .filter(Boolean);
const FRONTEND_SITE_URL = parseOptionalHttpUrl(
  process.env.FRONTEND_SITE_URL || "https://pizzeria-front-dqty.onrender.com",
  "FRONTEND_SITE_URL"
);
const SITEMAP_CACHE_SECONDS = parsePositiveInt(
  process.env.SITEMAP_CACHE_SECONDS,
  "SITEMAP_CACHE_SECONDS",
  300
);

module.exports = {
  NODE_ENV,
  JWT_SECRET,
  PORT,
  TRUST_PROXY,
  ENABLE_HSTS,
  HSTS_MAX_AGE,
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  AUTH_COOKIE_SECURE,
  AUTH_COOKIE_SAMESITE,
  AUTH_COOKIE_MAX_AGE,
  UPLOAD_DIR,
  UPLOAD_MAX_MB,
  UPLOAD_PUBLIC_BASE_URL,
  CORS_ORIGINS,
  PRINT_SCHEDULER_ENABLED,
  PRINT_SCHEDULER_INTERVAL_MS,
  PRINT_JOB_LOCK_MS,
  PRINT_RETRY_BASE_SECONDS,
  PRINT_RETRY_MAX_SECONDS,
  PRINT_DEFAULT_MAX_ATTEMPTS,
  PRINT_AGENT_OFFLINE_AFTER_MS,
  PRINT_JOB_RETENTION_HOURS,
  PRINT_JOB_CLEANUP_INTERVAL_MS,
  PRINT_READY_ALERT_AFTER_MINUTES,
  PRINT_READY_FAIL_AFTER_MINUTES,
  PRINT_REPRINT_READY_FAIL_AFTER_MINUTES,
  FRONTEND_SITE_URL,
  SITEMAP_CACHE_SECONDS,
};
