const userService = require("../services/user.service");

// Inscription
async function register(req, res) {
  try {
    const { name, email, phone, password } = req.body;
    const { user, token } = await userService.createUser({ name, email, phone, password });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Connexion
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const { user, token } = await userService.loginUser({ email, password });
    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Déconnexion (optionnel côté backend, juste retour 200)
async function logout(req, res) {
  res.json({ message: "Déconnexion réussie" });
}

// Récupérer les commandes de l'utilisateur connecté
async function getUserOrders(req, res) {
  try {
    const userId = req.user.userId; // via authMiddleware
    const orders = await userService.getOrdersByUserId(userId);
    res.status(200).json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
}

// Récupérer profil
async function me(req, res) {
  try {
    const user = await userService.getMe(req.user.userId);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Mettre à jour profil


async function updateMe(req, res) {
  try {
    const userId = req.user.userId; // Assure-toi que authMiddleware définit bien req.user.id
    const body = req.body;

    const updatedUser = await userService.updateMe(userId, body);

    // Ne renvoie pas le mot de passe
    const { password, ...userSafe } = updatedUser;

    res.status(200).json(userSafe);
  } catch (err) {
    console.error("Erreur UPDATE ME :", err);
    res.status(400).json({ error: err.message });
  }
}


// Admin
async function getAllUsers(req, res) {
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
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
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
    await userService.deleteUser(req.params.id);
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}


module.exports = {
  register,
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