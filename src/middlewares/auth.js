const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// Middleware pour vérifier que l'utilisateur est connecté
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      userId: decoded.userId || decoded.id, // ✅ toujours userId
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalide" });
  }
}


// Middleware pour vérifier que l'utilisateur est admin
function adminMiddleware(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Accès refusé, admin seulement" });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };