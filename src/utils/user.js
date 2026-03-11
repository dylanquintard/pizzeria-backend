function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    role: user.role,
  };
}

module.exports = {
  sanitizeUser,
};
