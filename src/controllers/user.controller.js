const userService = require("../services/user.service");
const reviewService = require("../services/review.service");
const crypto = require("crypto");
const {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  AUTH_COOKIE_SAMESITE,
  AUTH_COOKIE_SECURE,
} = require("../lib/env");

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function shouldIncludeAuthToken(req) {
  const queryValue = String(req.query?.includeToken || req.query?.include_token || "").trim().toLowerCase();
  const bodyValue = String(req.body?.includeToken || req.body?.include_token || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(queryValue) || ["1", "true", "yes", "on"].includes(bodyValue);
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAMESITE,
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildCsrfHeaderName() {
  return CSRF_HEADER_NAME
    .split("-")
    .map((part) => {
      const normalized = String(part || "").toLowerCase();
      if (normalized === "csrf") return "CSRF";
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join("-");
}

function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAMESITE,
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAMESITE,
    path: "/",
  });
}

function issueCsrfToken(res) {
  const token = createCsrfToken();
  setCsrfCookie(res, token);
  res.setHeader(buildCsrfHeaderName(), token);
  return token;
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: AUTH_COOKIE_SAMESITE,
    path: "/",
  });
}

function sendError(res, err, defaultStatus = 400) {
  const status = Number(err?.status) || defaultStatus;
  const payload = {
    error: err?.message || "Unexpected error",
  };

  if (err?.code) payload.code = err.code;
  if (err?.details && typeof err.details === "object") {
    Object.assign(payload, err.details);
  }

  return res.status(status).json(payload);
}

async function register(req, res) {
  try {
    setNoStore(res);
    const { name, firstName, lastName, email, phone, password } = req.body;
    const result = await userService.createUser({
      name,
      firstName,
      lastName,
      email,
      phone,
      password,
    });
    res.status(201).json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function login(req, res) {
  try {
    setNoStore(res);
    const { email, password } = req.body;
    const { user, token } = await userService.loginUser({ email, password });
    setAuthCookie(res, token);
    issueCsrfToken(res);
    if (shouldIncludeAuthToken(req)) {
      res.json({ user, token });
      return;
    }
    res.json({ user });
  } catch (err) {
    sendError(res, err);
  }
}

async function verifyEmail(req, res) {
  try {
    setNoStore(res);
    const { email, code } = req.body;
    const result = await userService.verifyEmailCode({ email, code });
    if (result?.token) {
      setAuthCookie(res, result.token);
      issueCsrfToken(res);
    }
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function resendEmailVerification(req, res) {
  try {
    setNoStore(res);
    const { email } = req.body;
    const result = await userService.resendEmailVerificationCode({ email });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function forgotPassword(req, res) {
  try {
    setNoStore(res);
    const { email } = req.body;
    const result = await userService.forgotPassword({ email });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function resetPassword(req, res) {
  try {
    setNoStore(res);
    const { email, token, password } = req.body || {};
    const result = await userService.resetPassword({ email, token, password });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function logout(_req, res) {
  setNoStore(res);
  clearAuthCookie(res);
  clearCsrfCookie(res);
  res.json({ message: "Logout successful" });
}

async function getUserOrders(req, res) {
  try {
    setNoStore(res);
    const userId = req.user.userId;
    const orders = await userService.getOrdersByUserId(userId);
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}

async function upsertOrderReview(req, res) {
  try {
    setNoStore(res);
    const userId = req.user.userId;
    const { orderId } = req.params;
    const review = await reviewService.upsertOrderReview(userId, orderId, req.body || {});
    res.status(200).json(review);
  } catch (err) {
    const message = err?.message || "Unable to save review";
    const status =
      message === "Order not found"
        ? 404
        : message === "Only finalized orders can be reviewed"
          ? 400
          : 400;
    res.status(status).json({ error: message });
  }
}

async function me(req, res) {
  try {
    setNoStore(res);
    issueCsrfToken(res);
    const user = await userService.getMe(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateMe(req, res) {
  try {
    setNoStore(res);
    const userId = req.user.userId;
    const updatedUser = await userService.updateMe(userId, req.body);
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function csrfToken(_req, res) {
  setNoStore(res);
  const token = issueCsrfToken(res);
  res.json({ csrfToken: token });
}

async function getAllUsers(_req, res) {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUserById(req, res) {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function adminUpdateUserRole(req, res) {
  try {
    const { role } = req.body;
    const updatedUser = await userService.updateUserRole(req.params.id, role);
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function adminDeleteUser(req, res) {
  try {
    const deletedUser = await userService.deleteUser(req.params.id);
    res.json({ message: "User deleted", user: deletedUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  register,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword,
  login,
  logout,
  getUserOrders,
  upsertOrderReview,
  me,
  csrfToken,
  updateMe,
  getAllUsers,
  getUserById,
  adminUpdateUserRole,
  adminDeleteUser,
};
