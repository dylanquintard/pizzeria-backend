const test = require("node:test");
const assert = require("node:assert/strict");

const orderController = require("../src/controllers/order.controller");
const orderService = require("../src/services/order.service");

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("updateOrderStatusAdmin rejects manual PRINTED status", async () => {
  const originalGetOrderById = orderService.getOrderById;

  orderService.getOrderById = async () => ({ id: 14, status: "COMPLETED" });

  try {
    const res = createResponseRecorder();

    await orderController.updateOrderStatusAdmin(
      {
        user: { id: 9, role: "ADMIN" },
        params: { orderId: "14" },
        body: { status: "PRINTED" },
      },
      res
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /cannot be applied manually/i);
  } finally {
    orderService.getOrderById = originalGetOrderById;
  }
});

test("updateOrderStatusAdmin allows FINALIZED and forwards admin actor", async () => {
  const originalGetOrderById = orderService.getOrderById;
  const originalUpdateOrderStatusAdmin = orderService.updateOrderStatusAdmin;

  let capturedArgs = null;

  orderService.getOrderById = async () => ({ id: 14, status: "COMPLETED" });
  orderService.updateOrderStatusAdmin = async (...args) => {
    capturedArgs = args;
    return { id: 14, status: "FINALIZED" };
  };

  try {
    const res = createResponseRecorder();

    await orderController.updateOrderStatusAdmin(
      {
        user: { id: 9, role: "ADMIN" },
        params: { orderId: "14" },
        body: { status: "FINALIZED" },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedArgs, ["14", "FINALIZED", 9]);
    assert.equal(res.body.status, "FINALIZED");
  } finally {
    orderService.getOrderById = originalGetOrderById;
    orderService.updateOrderStatusAdmin = originalUpdateOrderStatusAdmin;
  }
});
