require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { CORS_ORIGINS, PORT } = require("./lib/env");

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
