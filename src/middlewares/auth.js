const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../lib/env");
const prisma = require("../lib/prisma");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token missing" });
  }

  const token = authHeader.split(" ")[1];

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
