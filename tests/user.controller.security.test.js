const test = require("node:test");
const assert = require("node:assert/strict");

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
