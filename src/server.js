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
const { createOriginGuard } = require("./middlewares/csrf");

const app = express();
app.disable("x-powered-by");
if (TRUST_PROXY) app.set("trust proxy", 1);

const GOOGLE_SITE_VERIFICATION_FILE = "googlef435f264d8416a8b.html";
const GOOGLE_SITE_VERIFICATION_CONTENT =
  "google-site-verification: googlef435f264d8416a8b.html";

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
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  exposedHeaders: ["X-CSRF-Token"],
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(
  createOriginGuard({
    normalizeOrigin,
    isAllowedOrigin,
  })
);
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

const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const timeSlotRoutes = require("./routes/timeslot.routes");
const userRoutes = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const locationRoutes = require("./routes/location.routes");
const galleryRoutes = require("./routes/gallery.routes");
const blogRoutes = require("./routes/blog.routes");
const contactRoutes = require("./routes/contact.routes");
const realtimeRoutes = require("./routes/realtime.routes");
const printRoutes = require("./routes/print.routes");
const seoRoutes = require("./routes/seo.routes");
const seoController = require("./controllers/seo.controller");
const { startPrintScheduler, stopPrintScheduler } = require("./services/print.service");

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/print", printRoutes);
app.use("/api/seo", seoRoutes);
app.get("/sitemap.xml", seoController.getSitemapXml);
app.get(`/${GOOGLE_SITE_VERIFICATION_FILE}`, (_req, res) => {
  res.type("text/plain; charset=utf-8").send(GOOGLE_SITE_VERIFICATION_CONTENT);
});

app.get("/", (_req, res) => {
  res.send("API Pizzeria running");
});

app.listen(PORT, () => {
  startPrintScheduler();
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  stopPrintScheduler();
});

process.on("SIGINT", () => {
  stopPrintScheduler();
});
