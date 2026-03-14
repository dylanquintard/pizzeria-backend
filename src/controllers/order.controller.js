const orderService = require("../services/order.service");
const orderEmailService = require("../services/order-email.service");
const webPushService = require("../services/web-push.service");
const { emitRealtimeEvent } = require("../lib/realtime");

function getUserId(req) {
  return req.user?.userId || req.user?.id;
}

async function getCart(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const cart = await orderService.getCartByUserId(userId);
    res.json(cart);
  } catch (err) {
    console.error("getCart error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addToCart(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { productId, quantity, customizations } = req.body;
    const cart = await orderService.addToCart(
      userId,
      productId,
      quantity,
      customizations
    );

    emitRealtimeEvent(
      "cart:updated",
      {
        type: "cart-item-added",
        userId: Number(userId),
        orderId: cart?.id || null,
      },
      { userIds: [userId] }
    );

    res.json(cart);
  } catch (err) {
    console.error("addToCart error:", err);
    res.status(400).json({ error: err.message });
  }
}

async function removeItem(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const cart = await orderService.removeItemFromCart(userId, req.params.itemId);

    emitRealtimeEvent(
      "cart:updated",
      {
        type: "cart-item-removed",
        userId: Number(userId),
        orderId: cart?.id || null,
      },
      { userIds: [userId] }
    );

    res.json(cart);
  } catch (err) {
    console.error("removeItem error:", err);
    res.status(400).json({ error: err.message });
  }
}

async function finalizeOrder(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { pickupDate, pickupTime, locationId, customerNote, note } = req.body || {};
    const order = await orderService.finalizeOrder(userId, {
      pickupDate,
      pickupTime,
      locationId,
      customerNote,
      note,
    });

    emitRealtimeEvent(
      "orders:admin-updated",
      {
        type: "order-created",
        orderId: order?.id || null,
        status: order?.status || null,
        userId: order?.user?.id || Number(userId),
        timeSlotId: order?.timeSlot?.id || null,
      },
      { roles: ["ADMIN"] }
    );

    emitRealtimeEvent(
      "orders:user-updated",
      {
        type: "order-created",
        orderId: order?.id || null,
        status: order?.status || null,
      },
      { userIds: [userId] }
    );

    emitRealtimeEvent("timeslots:updated", {
      type: "order-created",
      orderId: order?.id || null,
      timeSlotId: order?.timeSlot?.id || null,
    });

    try {
      const emailData = await orderService.getOrderConfirmationEmailData(order?.id);
      if (emailData?.toEmail) {
        await orderEmailService.sendOrderConfirmationEmail(emailData);
      }
    } catch (mailErr) {
      console.error("finalizeOrder email error:", mailErr);
    }

    try {
      await webPushService.sendNewOrderPushToAdmins(order);
    } catch (pushErr) {
      console.error("finalizeOrder push error:", pushErr);
    }

    res.json(order);
  } catch (err) {
    console.error("finalizeOrder error:", err);
    res.status(400).json({ error: err.message });
  }
}

async function getOrdersAdmin(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId || req.user.role !== "ADMIN") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { date, status, filterUserId } = req.query;
    const filters = {};
    if (date) filters.date = date;
    if (status) filters.status = status;
    if (filterUserId) filters.userId = Number(filterUserId);

    const orders = await orderService.getOrdersAdmin(filters);
    res.json(orders);
  } catch (err) {
    console.error("getOrdersAdmin error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteOrderAdmin(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId || req.user.role !== "ADMIN") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { orderId } = req.params;
    const existingOrder = await orderService.getOrderById(orderId);
    await orderService.deleteOrder(orderId);

    emitRealtimeEvent(
      "orders:admin-updated",
      {
        type: "order-deleted",
        orderId: Number(orderId),
      },
      { roles: ["ADMIN"] }
    );

    if (existingOrder?.user?.id) {
      emitRealtimeEvent(
        "orders:user-updated",
        {
          type: "order-deleted",
          orderId: Number(orderId),
        },
        { userIds: [existingOrder.user.id] }
      );
    }

    if (existingOrder?.timeSlot?.id) {
      emitRealtimeEvent("timeslots:updated", {
        type: "order-deleted",
        orderId: Number(orderId),
        timeSlotId: existingOrder.timeSlot.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteOrderAdmin error:", err);
    res.status(400).json({ error: err.message });
  }
}

async function updateOrderStatusAdmin(req, res) {
  try {
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { orderId } = req.params;
    const { status } = req.body;
    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const normalizedStatus = String(status || "").trim().toUpperCase();

    if (normalizedStatus === "PRINTED") {
      return res.status(400).json({
        error: "PRINTED is a derived workflow status and cannot be applied manually.",
      });
    }

    const updatedOrder = await orderService.updateOrderStatusAdmin(
      orderId,
      status,
      getUserId(req)
    );

    emitRealtimeEvent(
      "orders:admin-updated",
      {
        type: "order-status-updated",
        orderId: updatedOrder?.id || Number(orderId),
        status: updatedOrder?.status || String(status || "").toUpperCase(),
      },
      { roles: ["ADMIN"] }
    );

    if (updatedOrder?.user?.id) {
      emitRealtimeEvent(
        "orders:user-updated",
        {
          type: "order-status-updated",
          orderId: updatedOrder.id,
          status: updatedOrder.status,
        },
        { userIds: [updatedOrder.user.id] }
      );
    }

    if (updatedOrder?.timeSlot?.id) {
      emitRealtimeEvent("timeslots:updated", {
        type: "order-status-updated",
        orderId: updatedOrder.id,
        timeSlotId: updatedOrder.timeSlot.id,
      });
    }

    if (normalizedStatus === "VALIDATE") {
      try {
        const emailData = await orderService.getOrderValidationEmailData(orderId);
        if (emailData?.toEmail) {
          await orderEmailService.sendOrderValidationEmail(emailData);
        }
      } catch (mailErr) {
        console.error("updateOrderStatusAdmin validation email error:", mailErr);
      }
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error("updateOrderStatusAdmin error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getCart,
  addToCart,
  removeItem,
  finalizeOrder,
  getOrdersAdmin,
  deleteOrderAdmin,
  updateOrderStatusAdmin,
};
