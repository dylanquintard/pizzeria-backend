const siteSettingsService = require("../services/site-settings.service");

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
}

async function getPublicSiteSettings(_req, res) {
  try {
    setNoStoreHeaders(res);
    const settings = await siteSettingsService.getPublicSiteSettings();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAdminSiteSettings(_req, res) {
  try {
    setNoStoreHeaders(res);
    const settings = await siteSettingsService.getAdminSiteSettings();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateSiteSettings(req, res) {
  try {
    setNoStoreHeaders(res);
    const settings = await siteSettingsService.updateSiteSettings(req.body);
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function translateSiteSettingsToEnglish(req, res) {
  try {
    setNoStoreHeaders(res);
    const translated = await siteSettingsService.translateSiteSettingsToEnglish(req.body);
    res.json(translated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getAdminSiteSettings,
  getPublicSiteSettings,
  translateSiteSettingsToEnglish,
  updateSiteSettings,
};
