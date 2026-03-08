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
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "https://pizzeria-front-dqty.onrender.com,http://localhost:3000/")
  .split(",")
  .map((item) => normalizeOrigin(item))
  .filter(Boolean);

module.exports = {
  NODE_ENV,
  JWT_SECRET,
  PORT,
  TRUST_PROXY,
  ENABLE_HSTS,
  HSTS_MAX_AGE,
  CORS_ORIGINS,
};
