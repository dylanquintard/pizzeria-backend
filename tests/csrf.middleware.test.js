const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateCsrfTokenPair,
  createOriginGuard,
  extractOriginFromReferer,
} = require("../src/middlewares/csrf");

test("validateCsrfTokenPair accepts safe methods without token", () => {
  const isValid = validateCsrfTokenPair({
    method: "GET",
    csrfCookieToken: "",
    csrfHeaderToken: "",
  });
  assert.equal(isValid, true);
});

test("validateCsrfTokenPair rejects missing token on mutating methods", () => {
  const isValid = validateCsrfTokenPair({
    method: "POST",
    csrfCookieToken: "",
    csrfHeaderToken: "",
  });
  assert.equal(isValid, false);
});

test("validateCsrfTokenPair accepts matching token on mutating methods", () => {
  const isValid = validateCsrfTokenPair({
    method: "PATCH",
    csrfCookieToken: "abc123",
    csrfHeaderToken: "abc123",
  });
  assert.equal(isValid, true);
});

test("extractOriginFromReferer returns empty string on invalid referer", () => {
  assert.equal(extractOriginFromReferer("not-a-url"), "");
});

test("createOriginGuard blocks unknown origin on mutating request", () => {
  const middleware = createOriginGuard({
    normalizeOrigin: (origin) => String(origin || "").trim().replace(/\/+$/, ""),
    isAllowedOrigin: (origin) => origin === "https://trusted.example",
  });

  const req = {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      host: "api.trusted.example",
    },
    secure: true,
  };

  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };

  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: "Origin denied" });
});

