require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  CORS_ORIGINS,
  PORT,
  TRUST_PROXY,
  ENABLE_HSTS,
  HSTS_MAX_AGE,
  UPLOAD_DIR,
} = require("./lib/env");

const app = express();
app.disable("x-powered-by");
if (TRUST_PROXY) app.set("trust proxy", 1);

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
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.secure || String(forwardedProto || "").toLowerCase() === "https";
  if (ENABLE_HSTS && isHttps) {
    res.setHeader("Strict-Transport-Security", `max-age=${HSTS_MAX_AGE}; includeSubDomains`);
  }
  next();
});
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

const pizzaRoutes = require("./routes/pizza.routes");
const orderRoutes = require("./routes/order.routes");
const timeSlotRoutes = require("./routes/timeslot.routes");
const userRoutes = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const locationRoutes = require("./routes/location.routes");
const galleryRoutes = require("./routes/gallery.routes");
const contactRoutes = require("./routes/contact.routes");

app.use("/api/pizzas", pizzaRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/contact", contactRoutes);

app.get("/", (_req, res) => {
  res.send("API Pizzeria running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
