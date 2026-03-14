const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-with-at-least-32-characters";

const { authMiddleware, adminMiddleware } = require("../src/middlewares/auth");

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

test("authMiddleware rejects requests without token", async () => {
  const req = { headers: {}, method: "GET" };
  const res = createResponseRecorder();
  let nextCalled = false;

  await authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Token missing" });
});

test("adminMiddleware blocks non-admin users", () => {
  const req = { user: { userId: 1, role: "CLIENT" } };
  const res = createResponseRecorder();
  let nextCalled = false;

  adminMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Admin access only" });
});

test("adminMiddleware allows admin users", () => {
  const req = { user: { userId: 1, role: "ADMIN" } };
  const res = createResponseRecorder();
  let nextCalled = false;

  adminMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, null);
});
