const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// Générer token JWT
function generateToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

// Créer un utilisateur (inscription)
async function createUser(data) {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) throw new Error("Cet email est déjà utilisé");

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashedPassword,
      role: "CLIENT",
    },
  });

  const token = generateToken(user);
  return { user, token };
}

// Login utilisateur
async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Email ou mot de passe incorrect");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Email ou mot de passe incorrect");

  const token = generateToken(user);
  return { user, token };
}

// Récupérer toutes les commandes d'un utilisateur
async function getOrdersByUserId(userId) {
  userId = Number(userId);
  if (!userId) throw new Error("userId manquant");

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { pizza: true } },
      timeSlot: true,
      user: true,
    },
  });

  // Normaliser le format pour le frontend
  return Promise.all(orders.map(formatOrderForFrontend));
}

// Helper pour le frontend
async function formatOrderForFrontend(order) {
  if (!order) return null;

  const items = await Promise.all(
    order.items.map(async (item) => ({
      id: item.id,
      pizza: { id: item.pizza.id, name: item.pizza.name, basePrice: item.pizza.basePrice },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      addedIngredients: item.addedIngredients || [],
      removedIngredients: item.removedIngredients || [],
    }))
  );

  return {
    id: order.id,
    status: order.status,
    totalPrice: order.total,
    timeSlot: order.timeSlot || null,
    createdAt: order.createdAt,
    items,
  };
}

// Récupérer son profil
async function getMe(userId) {
  return prisma.user.findUnique({ where: { id: parseInt(userId) } });
}

// Modifier son profil
async function updateMe(userId, body) {
  if (!userId) throw new Error("Utilisateur non authentifié");

  const updateData = {};

  // Nom / téléphone
  if (typeof body.name === "string" && body.name.trim() !== "") {
    updateData.name = body.name.trim();
  }
  if (typeof body.phone === "string" && body.phone.trim() !== "") {
    updateData.phone = body.phone.trim();
  }

  // Changement de mot de passe
  if (body.oldPassword && body.newPassword) {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });

    const match = await bcrypt.compare(body.oldPassword, user.password);
    if (!match) throw new Error("Ancien mot de passe incorrect");

    updateData.password = await bcrypt.hash(body.newPassword, SALT_ROUNDS);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("Aucune donnée à mettre à jour");
  }

  const updatedUser = await prisma.user.update({
    where: { id: Number(userId) },
    data: updateData,
  });

  return updatedUser;
}


// Gestion utilisateurs pour admin
async function getAllUsers() {
  return prisma.user.findMany();
}

async function getUserById(id) {
  return prisma.user.findUnique({ where: { id: parseInt(id) } });
}

async function updateUserRole(userId, newRole) {
  const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
  if (!user) throw new Error("Utilisateur introuvable");

  return prisma.user.update({
    where: { id: parseInt(userId) },
    data: { role: newRole },
  });
}

async function deleteUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
  if (!user) throw new Error("Utilisateur introuvable");

  return prisma.user.delete({ where: { id: parseInt(userId) } });
}

module.exports = {
  createUser,
  loginUser,
  getOrdersByUserId,
  getMe,
  updateMe,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
};