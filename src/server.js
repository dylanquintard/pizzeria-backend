require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { CORS_ORIGINS, JWT_SECRET, PORT } = require("./lib/env");

const app = express();
const normalizeOrigin = (origin) => String(origin || "").trim().replace(/\/+$/, "");
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return CORS_ORIGINS.includes(normalizeOrigin(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
};

app.use(express.json());
app.use(cors(corsOptions));

const pizzaRoutes = require("./routes/pizza.routes");
const orderRoutes = require("./routes/order.routes");
const timeSlotRoutes = require("./routes/timeslot.routes");
const userRoutes = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const locationRoutes = require("./routes/location.routes");
const galleryRoutes = require("./routes/gallery.routes");
const messageRoutes = require("./routes/message.routes");

app.use("/api/pizzas", pizzaRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (_req, res) => {
  res.send("API Pizzeria running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ["GET", "POST"],
  },
});

function extractToken(payload) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload.token === "string") return payload.token;
  return null;
}

function decodeTokenOrAckError(payload, ack) {
  const token = extractToken(payload);
  if (!token) {
    ack({ ok: false, error: "Token missing" });
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    ack({ ok: false, error: "Invalid token" });
    return null;
  }
}

io.on("connection", (socket) => {
  socket.on("joinAdminRoom", (payload = {}, ack = () => {}) => {
    const decoded = decodeTokenOrAckError(payload, ack);
    if (!decoded) return;

    if (decoded.role !== "ADMIN") {
      ack({ ok: false, error: "Admin role required" });
      return;
    }

    socket.join("admins");
    ack({ ok: true });
  });

  socket.on("joinUserRoom", (payload = {}, ack = () => {}) => {
    const decoded = decodeTokenOrAckError(payload, ack);
    if (!decoded) return;

    const userId = Number(decoded.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      ack({ ok: false, error: "Invalid user id" });
      return;
    }

    socket.join(`user:${userId}`);
    ack({ ok: true });
  });
});

app.set("io", io);

server.listen(PORT, () => {
  console.log(`Server and Socket running on port ${PORT}`);
});
