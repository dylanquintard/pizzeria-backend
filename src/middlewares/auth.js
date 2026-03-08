const jwt = require("jsonwebtoken");
const { AUTH_COOKIE_NAME, JWT_SECRET } = require("../lib/env");
const prisma = require("../lib/prisma");

function parseCookies(cookieHeader) {
  const result = {};
  const raw = String(cookieHeader || "");
  if (!raw) return result;

  for (const part of raw.split(";")) {
    const [name, ...rest] = part.split("=");
    const key = String(name || "").trim();
    if (!key) continue;
    const value = rest.join("=").trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch (_err) {
      result[key] = value;
    }
  }

  return result;
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
  const cookieToken = parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME];
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const userId = Number(decoded.userId ?? decoded.id);

    if (!Number.isInteger(userId)) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      userId: dbUser.id,
      role: dbUser.role,
    };

    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access only" });
  }

  return next();
}

module.exports = { authMiddleware, adminMiddleware };
