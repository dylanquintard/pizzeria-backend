const userService = require("../services/user.service");

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
    const { name, email, phone, password } = req.body;
    const result = await userService.createUser({
      name,
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
    const { email, password } = req.body;
    const { user, token } = await userService.loginUser({ email, password });
    res.json({ user, token });
  } catch (err) {
    sendError(res, err);
  }
}

async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    const result = await userService.verifyEmailCode({ email, code });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function resendEmailVerification(req, res) {
  try {
    const { email } = req.body;
    const result = await userService.resendEmailVerificationCode({ email });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

async function logout(_req, res) {
  res.json({ message: "Logout successful" });
}

async function getUserOrders(req, res) {
  try {
    const userId = req.user.userId;
    const orders = await userService.getOrdersByUserId(userId);
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}

async function me(req, res) {
  try {
    const user = await userService.getMe(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateMe(req, res) {
  try {
    const userId = req.user.userId;
    const updatedUser = await userService.updateMe(userId, req.body);
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
  login,
  logout,
  getUserOrders,
  me,
  updateMe,
  getAllUsers,
  getUserById,
  adminUpdateUserRole,
  adminDeleteUser,
};
