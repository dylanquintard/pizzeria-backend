require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const corsOptions = {
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

app.use(express.json());
app.use(cors(corsOptions));

// Routes
const pizzaRoutes = require("./routes/pizza.routes");
const orderRoutes = require("./routes/order.routes");
const timeSlotRoutes = require("./routes/timeslot.routes");
const userRoutes = require("./routes/user.routes");

app.use("/api/pizzas", pizzaRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.send("API Pizzeria running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Socket setup
const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinAdminRoom", () => {
    socket.join("admins");
    console.log("Admin joined admins room");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Make io available in route handlers
app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server + Socket running on port ${PORT}`);
});
