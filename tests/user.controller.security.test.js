const test = require("node:test");
const assert = require("node:assert/strict");
const userService = require("../src/services/user.service");

function loadUserControllerForNodeEnv(nodeEnv) {
  const controllerPath = require.resolve("../src/controllers/user.controller");
  const envPath = require.resolve("../src/lib/env");

  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  delete require.cache[controllerPath];
  delete require.cache[envPath];

  const controller = require("../src/controllers/user.controller");

  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }

  delete require.cache[controllerPath];
  delete require.cache[envPath];

  return controller;
}

test("includeToken stays available outside production for non-browser clients", () => {
  const controller = loadUserControllerForNodeEnv("development");
  const result = controller.__testing.shouldIncludeAuthToken({
    query: { includeToken: "true" },
    body: {},
  });

  assert.equal(result, true);
});

test("includeToken is always disabled in production", () => {
  const controller = loadUserControllerForNodeEnv("production");
  const result = controller.__testing.shouldIncludeAuthToken({
    query: { includeToken: "true" },
    body: { include_token: "1" },
  });

  assert.equal(result, false);
});

test("me refreshes the authenticated session cookies", async () => {
  const controller = loadUserControllerForNodeEnv("production");
  const originalGetMe = userService.getMe;
  const originalIssueSessionToken = userService.issueSessionToken;

  let authCookie = null;
  let csrfCookie = null;

  userService.getMe = async () => ({
    id: 4,
    role: "ADMIN",
    email: "admin@site.test",
  });
  userService.issueSessionToken = () => "renewed-token";

  try {
    const res = {
      headers: {},
      payload: null,
      cookie(name, value) {
        if (String(name).includes("auth")) authCookie = value;
        if (String(name).includes("csrf")) csrfCookie = value;
      },
      setHeader(name, value) {
        this.headers[name] = value;
      },
      json(value) {
        this.payload = value;
        return this;
      },
      status() {
        return this;
      },
    };

    await controller.me({ user: { userId: 4 } }, res);

    assert.equal(authCookie, "renewed-token");
    assert.ok(typeof csrfCookie === "string" && csrfCookie.length > 0);
    assert.equal(res.payload?.id, 4);
  } finally {
    userService.getMe = originalGetMe;
    userService.issueSessionToken = originalIssueSessionToken;
  }
});
