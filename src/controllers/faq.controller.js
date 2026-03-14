const faqService = require("../services/faq.service");

async function getPublicFaqEntries(req, res) {
  try {
    const items = await faqService.getPublicFaqEntries(req.query.path);
    res.json({
      path: String(req.query.path || "/"),
      items,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAdminFaqTargets(_req, res) {
  try {
    const targets = await faqService.getAdminFaqTargets();
    res.json({ targets });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAdminFaqEntries(req, res) {
  try {
    const payload = await faqService.getAdminFaqEntries(req.query.path);
    res.json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createFaqEntry(req, res) {
  try {
    const item = await faqService.createFaqEntry(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateFaqEntry(req, res) {
  try {
    const item = await faqService.updateFaqEntry(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteFaqEntry(req, res) {
  try {
    await faqService.deleteFaqEntry(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getPublicFaqEntries,
  getAdminFaqTargets,
  getAdminFaqEntries,
  createFaqEntry,
  updateFaqEntry,
  deleteFaqEntry,
};
