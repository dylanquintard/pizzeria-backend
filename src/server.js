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

io.on("connection", (socket) => {
  socket.on("joinAdminRoom", (payload = {}, ack = () => {}) => {
    const token =
      typeof payload === "string"
        ? payload
        : typeof payload.token === "string"
          ? payload.token
          : null;

    if (!token) {
      ack({ ok: false, error: "Token missing" });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== "ADMIN") {
        ack({ ok: false, error: "Admin role required" });
        return;
      }

      socket.join("admins");
      ack({ ok: true });
    } catch (_err) {
      ack({ ok: false, error: "Invalid token" });
    }
  });
});

app.set("io", io);

server.listen(PORT, () => {
  console.log(`Server and Socket running on port ${PORT}`);
});
