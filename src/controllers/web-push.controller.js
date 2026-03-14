const webPushService = require("../services/web-push.service");

async function getPublicVapidKey(_req, res) {
  try {
    res.json({
      publicKey: webPushService.getPublicVapidKey(),
      enabled: webPushService.isWebPushEnabled(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function upsertSubscription(req, res) {
  try {
    const payload = await webPushService.upsertWebPushSubscription({
      userId: req.user?.userId,
      role: req.user?.role,
      subscription: req.body?.subscription,
      userAgent: req.headers["user-agent"],
    });
    res.status(200).json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteSubscription(req, res) {
  try {
    const payload = await webPushService.deleteWebPushSubscription({
      userId: req.user?.userId,
      endpoint: req.body?.endpoint,
    });
    res.status(200).json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getPublicVapidKey,
  upsertSubscription,
  deleteSubscription,
};
