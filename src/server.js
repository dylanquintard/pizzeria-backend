require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(express.json());
app.use(cors());

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
  res.send("API Pizzeria running 🚀");
});

// ================= SOCKET SETUP =================

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // ton front React
    methods: ["GET", "POST"],
  },
});

// Room pour les admins uniquement
io.on("connection", (socket) => {
  console.log("Utilisateur connecté :", socket.id);

  socket.on("joinAdminRoom", () => {
    socket.join("admins");
    console.log("Admin rejoint la room admins");
  });

  socket.on("disconnect", () => {
    console.log("Utilisateur déconnecté :", socket.id);
  });
});

// Rendre io accessible ailleurs
app.set("io", io);

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server + Socket running on port ${PORT}`);
});