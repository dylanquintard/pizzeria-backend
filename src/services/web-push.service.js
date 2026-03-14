const webPush = require("web-push");
const prisma = require("../lib/prisma");
const {
  WEB_PUSH_SUBJECT,
  WEB_PUSH_VAPID_PRIVATE_KEY,
  WEB_PUSH_VAPID_PUBLIC_KEY,
} = require("../lib/env");

let vapidConfigured = false;

function isWebPushEnabled() {
  return Boolean(WEB_PUSH_VAPID_PUBLIC_KEY && WEB_PUSH_VAPID_PRIVATE_KEY);
}

function ensureWebPushConfigured() {
  if (!isWebPushEnabled()) {
    throw new Error("Web push is not configured");
  }

  if (vapidConfigured) return;

  webPush.setVapidDetails(
    WEB_PUSH_SUBJECT,
    WEB_PUSH_VAPID_PUBLIC_KEY,
    WEB_PUSH_VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

function getPublicVapidKey() {
  return WEB_PUSH_VAPID_PUBLIC_KEY || "";
}

function normalizeSubscription(subscription) {
  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription payload");
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

async function upsertWebPushSubscription({ userId, role, subscription, userAgent }) {
  ensureWebPushConfigured();

  if (String(role || "").toUpperCase() !== "ADMIN") {
    throw new Error("Admin access only");
  }

  const normalized = normalizeSubscription(subscription);

  return prisma.webPushSubscription.upsert({
    where: { endpoint: normalized.endpoint },
    create: {
      userId: Number(userId),
      endpoint: normalized.endpoint,
      p256dh: normalized.keys.p256dh,
      auth: normalized.keys.auth,
      userAgent: String(userAgent || "").trim() || null,
      active: true,
    },
    update: {
      userId: Number(userId),
      p256dh: normalized.keys.p256dh,
      auth: normalized.keys.auth,
      userAgent: String(userAgent || "").trim() || null,
      active: true,
    },
    select: {
      id: true,
      endpoint: true,
      active: true,
      updatedAt: true,
    },
  });
}

async function deleteWebPushSubscription({ userId, endpoint }) {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) {
    throw new Error("Endpoint is required");
  }

  await prisma.webPushSubscription.deleteMany({
    where: {
      userId: Number(userId),
      endpoint: normalizedEndpoint,
    },
  });

  return { success: true };
}

function buildNewOrderPushPayload(order) {
  const createdAt = new Date(order?.createdAt || Date.now());
  const dateLabel = createdAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = createdAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    title: "NOUVELLE COMMANDE",
    body: `NOUVELLE COMMANDE : #${order?.id ?? "?"} le : ${dateLabel} - ${timeLabel}`,
    tag: `order-${order?.id ?? "unknown"}`,
    url: order?.id ? `/?orderId=${order.id}` : "/",
  };
}

async function markInactive(endpoint) {
  await prisma.webPushSubscription.updateMany({
    where: { endpoint },
    data: { active: false },
  });
}

async function markNotified(endpoint) {
  await prisma.webPushSubscription.updateMany({
    where: { endpoint },
    data: { lastNotifiedAt: new Date(), active: true },
  });
}

async function sendNewOrderPushToAdmins(order) {
  if (!isWebPushEnabled()) return { delivered: 0, skipped: true };

  ensureWebPushConfigured();
  const payload = JSON.stringify(buildNewOrderPushPayload(order));
  const subscriptions = await prisma.webPushSubscription.findMany({
    where: {
      active: true,
      user: {
        role: "ADMIN",
      },
    },
    select: {
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  let delivered = 0;
  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
        { TTL: 60 }
      );
      delivered += 1;
      await markNotified(subscription.endpoint);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if ([404, 410].includes(statusCode)) {
        await markInactive(subscription.endpoint);
      }
      console.error("sendNewOrderPushToAdmins error:", error?.message || error);
    }
  }

  return { delivered, skipped: false };
}

module.exports = {
  isWebPushEnabled,
  getPublicVapidKey,
  upsertWebPushSubscription,
  deleteWebPushSubscription,
  sendNewOrderPushToAdmins,
};
