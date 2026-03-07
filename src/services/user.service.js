const { Role } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { JWT_SECRET } = require("../lib/env");
const { sanitizeUser } = require("../utils/user");
const { normalizeCustomizations } = require("../utils/customizations");

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const DEFAULT_COUNTRY_DIAL_CODE = process.env.DEFAULT_COUNTRY_DIAL_CODE || "+33";

function generateToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function normalizeEmail(email) {
  if (typeof email !== "string") throw new Error("email is required");
  const value = email.trim().toLowerCase();
  if (!value) throw new Error("email is required");
  if (!EMAIL_REGEX.test(value)) throw new Error("Invalid email format");
  return value;
}

function normalizePhone(phone) {
  if (typeof phone !== "string") throw new Error("phone is required");
  const raw = phone.trim();
  if (!raw) throw new Error("phone is required");

  const compact = raw.replace(/[\s().-]/g, "");
  let normalized = compact;

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  } else if (normalized.startsWith("0")) {
    normalized = `${DEFAULT_COUNTRY_DIAL_CODE}${normalized.slice(1)}`;
  }

  if (!E164_PHONE_REGEX.test(normalized)) {
    throw new Error("Invalid phone format");
  }

  return normalized;
}

function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }
}

function validatePasswordInput(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password is required");
  }
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  if (!Object.values(Role).includes(normalized)) {
    throw new Error("Invalid role");
  }
  return normalized;
}

async function buildIngredientMapFromOrders(orders) {
  const ingredientIds = new Set();

  for (const order of orders) {
    for (const item of order.items) {
      const custom = normalizeCustomizations(item.customizations || {});
      for (const id of custom.addedIngredients) ingredientIds.add(id);
      for (const id of custom.removedIngredients) ingredientIds.add(id);
    }
  }

  if (ingredientIds.size === 0) return new Map();

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: [...ingredientIds] } },
    select: { id: true, name: true, price: true },
  });

  return new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
}

function formatOrderForFrontend(order, ingredientMap) {
  const items = order.items.map((item) => {
    const custom = normalizeCustomizations(item.customizations || {});

    const addedIngredients = custom.addedIngredients
      .map((id) => ingredientMap.get(id))
      .filter(Boolean)
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        price: Number(ingredient.price),
      }));

    const removedIngredients = custom.removedIngredients
      .map((id) => ingredientMap.get(id))
      .filter(Boolean)
      .map((ingredient) => ({ id: ingredient.id, name: ingredient.name }));

    return {
      id: item.id,
      pizza: {
        id: item.pizza.id,
        name: item.pizza.name,
        basePrice: Number(item.pizza.basePrice),
        category: item.pizza.category
          ? { id: item.pizza.category.id, name: item.pizza.category.name }
          : null,
      },
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      addedIngredients,
      removedIngredients,
    };
  });

  return {
    id: order.id,
    status: order.status,
    totalPrice: Number(order.total),
    timeSlot: order.timeSlot || null,
    createdAt: order.createdAt,
    items,
  };
}

async function createUser(data) {
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  validateNewPassword(data.password);

  const name = typeof data.name === "string" ? data.name.trim() : "";

  if (!name) throw new Error("name is required");

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("This email is already used");

  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      emailVerified: true,
      phoneVerified: true,
      role: Role.CLIENT,
    },
  });
  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  validatePasswordInput(password);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new Error("Invalid email or password");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid email or password");

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

async function getOrdersByUserId(userId) {
  const parsedUserId = parsePositiveInt(userId, "userId");

  const orders = await prisma.order.findMany({
    where: { userId: parsedUserId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { pizza: { include: { category: true } } } },
      timeSlot: { include: { location: true } },
    },
  });

  const ingredientMap = await buildIngredientMapFromOrders(orders);
  return orders.map((order) => formatOrderForFrontend(order, ingredientMap));
}

async function getMe(userId) {
  return prisma.user.findUnique({
    where: { id: parsePositiveInt(userId, "userId") },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
      role: true,
    },
  });
}

async function updateMe(userId, body) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const updateData = {};

  if (typeof body.name === "string" && body.name.trim() !== "") {
    updateData.name = body.name.trim();
  }

  if (typeof body.phone === "string" && body.phone.trim() !== "") {
    updateData.phone = normalizePhone(body.phone);
  }

  if (body.oldPassword && body.newPassword) {
    validateNewPassword(body.newPassword);

    const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
    if (!user) throw new Error("User not found");

    const match = await bcrypt.compare(body.oldPassword, user.password);
    if (!match) throw new Error("Old password is incorrect");

    updateData.password = await bcrypt.hash(body.newPassword, SALT_ROUNDS);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("No data to update");
  }

  const updatedUser = await prisma.user.update({
    where: { id: parsedUserId },
    data: updateData,
  });

  return sanitizeUser(updatedUser);
}

async function getAllUsers() {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
      role: true,
    },
  });

  return users.map(sanitizeUser);
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id: parsePositiveInt(id, "id") },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
      role: true,
    },
  });

  return sanitizeUser(user);
}

async function updateUserRole(userId, newRole) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const role = parseRole(newRole);

  const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
  if (!user) throw new Error("User not found");

  const updatedUser = await prisma.user.update({
    where: { id: parsedUserId },
    data: { role },
  });

  return sanitizeUser(updatedUser);
}

async function deleteUser(userId) {
  const parsedUserId = parsePositiveInt(userId, "userId");

  const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
  if (!user) throw new Error("User not found");

  return prisma.user.delete({
    where: { id: parsedUserId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
      role: true,
    },
  });
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
