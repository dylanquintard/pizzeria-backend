const contactService = require("../services/contact.service");

async function sendContactEmail(req, res) {
  try {
    const result = await contactService.sendContactEmail(req.body);
    res.status(201).json(result);
  } catch (err) {
    const status = Number(err?.status) || 400;
    res.status(status).json({ error: err?.message || "Unexpected error" });
  }
}

module.exports = {
  sendContactEmail,
};
