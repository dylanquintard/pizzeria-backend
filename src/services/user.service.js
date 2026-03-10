const { Role } = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { JWT_SECRET } = require("../lib/env");
const { sanitizeUser } = require("../utils/user");
const { normalizeCustomizations } = require("../utils/customizations");

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const OTP_CODE_REGEX = /^\d{6}$/;
const DEFAULT_COUNTRY_DIAL_CODE = process.env.DEFAULT_COUNTRY_DIAL_CODE || "+33";
const DEFAULT_EMAIL_OTP_TTL_MINUTES = 10;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const RANDOM_PASSWORD_LENGTH = 10;
const RANDOM_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*?";
const DELETED_PRODUCT_FALLBACK_NAME = "Produit supprime";
const ARCHIVED_USER_EMAIL =
  process.env.ARCHIVED_USER_EMAIL?.trim().toLowerCase() || "archived-user@local.invalid";
const ARCHIVED_USER_NAME =
  process.env.ARCHIVED_USER_NAME?.trim() || "Client supprime";
const ARCHIVED_USER_PHONE =
  process.env.ARCHIVED_USER_PHONE?.trim() || "+33100000000";

let emailTransporter = null;

function generateToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
    algorithm: "HS256",
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

function parseBooleanFlag(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function shouldLogEmailOtpDebug() {
  if (IS_PRODUCTION) return false;
  return parseBooleanFlag(process.env.EMAIL_OTP_DEBUG_LOGGING, false);
}

function shouldExposeEmailOtpCode() {
  if (IS_PRODUCTION) return false;
  return parseBooleanFlag(process.env.EXPOSE_EMAIL_OTP_IN_RESPONSE, false);
}

function getEmailOtpTtlMinutes() {
  const parsed = Number(process.env.EMAIL_OTP_TTL_MINUTES);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_EMAIL_OTP_TTL_MINUTES;
  }
  return parsed;
}

function normalizeOtpCode(code) {
  const value = String(code || "").trim();
  if (!OTP_CODE_REGEX.test(value)) {
    throw new Error("Invalid verification code format");
  }
  return value;
}

function getRequiredMailEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    const err = new Error(`Missing required environment variable: ${name}`);
    err.status = 500;
    throw err;
  }
  return String(value).trim();
}

function parseSmtpPort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error("Invalid SMTP_PORT value");
    err.status = 500;
    throw err;
  }
  return parsed;
}

function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;

  const host = getRequiredMailEnv("SMTP_HOST");
  const port = parseSmtpPort(getRequiredMailEnv("SMTP_PORT"));
  const user = getRequiredMailEnv("SMTP_USER");
  const pass = getRequiredMailEnv("SMTP_PASS");

  emailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return emailTransporter;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateSixDigitCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

function generateRandomPassword(length = RANDOM_PASSWORD_LENGTH) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const position = crypto.randomInt(0, RANDOM_PASSWORD_ALPHABET.length);
    value += RANDOM_PASSWORD_ALPHABET[position];
  }
  return value;
}

function getOtpExpirationDate() {
  const ttlMinutes = getEmailOtpTtlMinutes();
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}

function createEmailNotVerifiedError() {
  const err = new Error("Email not verified. Please enter the 6-digit code.");
  err.status = 403;
  err.code = "EMAIL_NOT_VERIFIED";
  return err;
}

async function sendVerificationEmail({ email, name, code }) {
  const from = process.env.SMTP_FROM?.trim() || getRequiredMailEnv("SMTP_USER");
  const smtpUser = getRequiredMailEnv("SMTP_USER");
  const ttlMinutes = getEmailOtpTtlMinutes();
  const subject = "Code de verification de votre email";

  const textBody = [
    `Bonjour ${name},`,
    "",
    "Merci pour votre inscription.",
    `Votre code de verification est : ${code}`,
    `Ce code expire dans ${ttlMinutes} minutes.`,
  ].join("\n");

  const htmlBody = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Merci pour votre inscription.</p>
    <p><strong>Votre code de verification :</strong> ${escapeHtml(code)}</p>
    <p>Ce code expire dans ${ttlMinutes} minutes.</p>
  `;

  try {
    const info = await getEmailTransporter().sendMail({
      from,
      to: email,
      envelope: {
        from: smtpUser,
        to: email,
      },
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (shouldLogEmailOtpDebug()) {
      console.log("[auth:otp] email queued", {
        to: email,
        code,
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
        response: info?.response || null,
      });
    }

    return {
      messageId: info?.messageId || null,
      accepted: info?.accepted || [],
      rejected: info?.rejected || [],
      response: info?.response || null,
    };
  } catch (_err) {
    const err = new Error("Unable to send verification email");
    err.status = 502;
    throw err;
  }
}

async function sendPasswordResetEmail({ email, name, temporaryPassword }) {
  const from = process.env.SMTP_FROM?.trim() || getRequiredMailEnv("SMTP_USER");
  const smtpUser = getRequiredMailEnv("SMTP_USER");
  const subject = "Reinitialisation de votre mot de passe";

  const textBody = [
    `Bonjour ${name},`,
    "",
    "Un nouveau mot de passe temporaire a ete genere pour votre compte.",
    `Nouveau mot de passe: ${temporaryPassword}`,
    "",
    "Connectez-vous puis changez ce mot de passe depuis votre profil.",
  ].join("\n");

  const htmlBody = `
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Un nouveau mot de passe temporaire a ete genere pour votre compte.</p>
    <p><strong>Nouveau mot de passe :</strong> ${escapeHtml(temporaryPassword)}</p>
    <p>Connectez-vous puis changez ce mot de passe depuis votre profil.</p>
  `;

  try {
    const info = await getEmailTransporter().sendMail({
      from,
      to: email,
      envelope: {
        from: smtpUser,
        to: email,
      },
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (shouldLogEmailOtpDebug()) {
      console.log("[auth:password-reset] email queued", {
        to: email,
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
        response: info?.response || null,
      });
    }
  } catch (_err) {
    const err = new Error("Unable to send password reset email");
    err.status = 502;
    throw err;
  }
}

async function setAndSendEmailVerificationCode(user) {
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expiresAt = getOtpExpirationDate();

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailOtpCode: codeHash,
      otpExpiresAt: expiresAt,
      emailVerified: false,
    },
  });

  try {
    await sendVerificationEmail({
      email: updatedUser.email,
      name: updatedUser.name,
      code,
    });
  } catch (err) {
    const strictDelivery = parseBooleanFlag(process.env.VERIFICATION_STRICT_DELIVERY, true);
    if (strictDelivery) {
      throw err;
    }
  }

  const exposeCode = shouldExposeEmailOtpCode();
  return {
    user: updatedUser,
    expiresAt,
    ...(exposeCode ? { debugEmailOtpCode: code } : {}),
  };
}

async function buildEmailVerificationChallengeForUser(user) {
  try {
    const challenge = await setAndSendEmailVerificationCode(user);
    const details = {
      verificationExpiresAt: challenge.expiresAt,
    };

    if (challenge.debugEmailOtpCode) {
      details.debugEmailOtpCode = challenge.debugEmailOtpCode;
    }

    return details;
  } catch (err) {
    if (shouldLogEmailOtpDebug()) {
      console.error("[auth:otp] unable to issue verification code during login", {
        userId: user?.id,
        email: user?.email,
        error: err?.message || "unknown_error",
      });
    }
    return null;
  }
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

    const productPayload = item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          basePrice: Number(item.product.basePrice),
          category: item.product.category
            ? { id: item.product.category.id, name: item.product.category.name }
            : null,
        }
      : {
          id: item.productId ?? null,
          name: DELETED_PRODUCT_FALLBACK_NAME,
          basePrice: Number(item.unitPrice),
          category: null,
          archived: true,
        };

    return {
      id: item.id,
      product: productPayload,
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
      emailVerified: false,
      phoneVerified: true,
      role: Role.CLIENT,
    },
  });

  try {
    const challenge = await setAndSendEmailVerificationCode(user);

    return {
      user: sanitizeUser(challenge.user),
      requiresEmailVerification: true,
      verificationExpiresAt: challenge.expiresAt,
      ...(challenge.debugEmailOtpCode
        ? { debugEmailOtpCode: challenge.debugEmailOtpCode }
        : {}),
    };
  } catch (err) {
    const strictDelivery = parseBooleanFlag(process.env.VERIFICATION_STRICT_DELIVERY, true);
    if (strictDelivery) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    throw err;
  }
}

async function verifyEmailCode({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = normalizeOtpCode(code);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new Error("Invalid or expired verification code");
  if (user.emailVerified) {
    const token = generateToken(user);
    return { user: sanitizeUser(user), token };
  }

  if (!user.emailOtpCode || !user.otpExpiresAt) {
    throw new Error("Invalid or expired verification code");
  }

  if (new Date(user.otpExpiresAt).getTime() < Date.now()) {
    throw new Error("Verification code expired");
  }

  const validCode = await bcrypt.compare(normalizedCode, user.emailOtpCode);
  if (!validCode) throw new Error("Invalid or expired verification code");

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailOtpCode: null,
      otpExpiresAt: null,
    },
  });

  const token = generateToken(verifiedUser);

  return {
    user: sanitizeUser(verifiedUser),
    token,
  };
}

async function resendEmailVerificationCode({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return { sent: true };
  }

  if (user.emailVerified) {
    return { sent: true, alreadyVerified: true };
  }

  const challenge = await setAndSendEmailVerificationCode(user);
  return {
    sent: true,
    verificationExpiresAt: challenge.expiresAt,
    ...(challenge.debugEmailOtpCode
      ? { debugEmailOtpCode: challenge.debugEmailOtpCode }
      : {}),
  };
}

async function forgotPassword({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Keep response identical to avoid account enumeration.
  if (!user) {
    return { sent: true };
  }

  const temporaryPassword = generateRandomPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      emailOtpCode: null,
      otpExpiresAt: null,
    },
  });

  try {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      temporaryPassword,
    });
  } catch (err) {
    // Roll back password change if delivery fails.
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: user.password },
      });
    } catch (_rollbackErr) {
      if (shouldLogEmailOtpDebug()) {
        console.error("[auth:password-reset] rollback failed", {
          userId: user.id,
          email: user.email,
        });
      }
    }
    throw err;
  }

  return { sent: true };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  validatePasswordInput(password);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new Error("Invalid email or password");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid email or password");
  if (!user.emailVerified) {
    const err = createEmailNotVerifiedError();
    const challenge = await buildEmailVerificationChallengeForUser(user);
    if (challenge) err.details = challenge;
    throw err;
  }

  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

async function getOrdersByUserId(userId) {
  const parsedUserId = parsePositiveInt(userId, "userId");

  const orders = await prisma.order.findMany({
    where: { userId: parsedUserId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: { include: { category: true } } } },
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
    where: {
      email: {
        not: ARCHIVED_USER_EMAIL,
      },
    },
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

async function getOrCreateArchivedUser(tx) {
  const existing = await tx.user.findUnique({ where: { email: ARCHIVED_USER_EMAIL } });
  if (existing) return existing;

  const fallbackPassword = generateRandomPassword(24);
  const hashedPassword = await bcrypt.hash(fallbackPassword, SALT_ROUNDS);

  try {
    return await tx.user.create({
      data: {
        name: ARCHIVED_USER_NAME,
        email: ARCHIVED_USER_EMAIL,
        phone: ARCHIVED_USER_PHONE,
        password: hashedPassword,
        emailVerified: true,
        phoneVerified: true,
        role: Role.CLIENT,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const concurrentCreated = await tx.user.findUnique({
        where: { email: ARCHIVED_USER_EMAIL },
      });
      if (concurrentCreated) return concurrentCreated;
    }
    throw err;
  }
}

async function deleteUser(userId) {
  const parsedUserId = parsePositiveInt(userId, "userId");

  const user = await prisma.user.findUnique({ where: { id: parsedUserId } });
  if (!user) throw new Error("User not found");
  if (user.email === ARCHIVED_USER_EMAIL) {
    throw new Error("Cannot delete archived placeholder user");
  }

  const orderCount = await prisma.order.count({ where: { userId: parsedUserId } });
  if (orderCount === 0) {
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

  return prisma.$transaction(async (tx) => {
    const archivedUser = await getOrCreateArchivedUser(tx);
    if (archivedUser.id === parsedUserId) {
      throw new Error("Cannot delete archived placeholder user");
    }

    const pendingOrders = await tx.order.findMany({
      where: { userId: parsedUserId, status: "PENDING" },
      select: { id: true },
    });

    if (pendingOrders.length > 0) {
      const pendingOrderIds = pendingOrders.map((entry) => entry.id);
      await tx.orderItem.deleteMany({
        where: { orderId: { in: pendingOrderIds } },
      });
      await tx.order.deleteMany({
        where: { id: { in: pendingOrderIds } },
      });
    }

    await tx.order.updateMany({
      where: { userId: parsedUserId },
      data: { userId: archivedUser.id },
    });

    return tx.user.delete({
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
  });
}

module.exports = {
  createUser,
  verifyEmailCode,
  resendEmailVerificationCode,
  forgotPassword,
  loginUser,
  getOrdersByUserId,
  getMe,
  updateMe,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
};
