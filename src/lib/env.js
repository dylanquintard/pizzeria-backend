function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

const JWT_SECRET = getRequiredEnv("JWT_SECRET");
const PORT = Number(process.env.PORT) || 5000;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "https://pizzeria-front-dqty.onrender.com,http://localhost:3000/")
  .split(",")
  .map((item) => normalizeOrigin(item))
  .filter(Boolean);

module.exports = {
  JWT_SECRET,
  PORT,
  CORS_ORIGINS,
};
