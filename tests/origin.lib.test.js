const test = require("node:test");
const assert = require("node:assert/strict");
const { isDevLocalOrigin, normalizeOrigin } = require("../src/lib/origin");

test("normalizeOrigin removes trailing slash", () => {
  assert.equal(normalizeOrigin("https://example.com/"), "https://example.com");
});

test("isDevLocalOrigin accepts localhost and private LAN origins", () => {
  assert.equal(isDevLocalOrigin("http://localhost:4173"), true);
  assert.equal(isDevLocalOrigin("http://127.0.0.1:4173"), true);
  assert.equal(isDevLocalOrigin("http://192.168.1.42:4173"), true);
  assert.equal(isDevLocalOrigin("http://10.0.0.42:4173"), true);
  assert.equal(isDevLocalOrigin("http://172.20.0.10:4173"), true);
});

test("isDevLocalOrigin rejects public origins", () => {
  assert.equal(isDevLocalOrigin("https://evil.example"), false);
  assert.equal(isDevLocalOrigin("https://frontend.example.com"), false);
});
