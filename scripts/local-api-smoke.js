/* eslint-disable no-console */
require("dotenv").config();

const os = require("node:os");
const { spawn } = require("node:child_process");
const jwt = require("jsonwebtoken");

const PORT = process.env.SMOKE_PORT || "5000";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET;
const USE_EXISTING_SERVER = process.env.SMOKE_USE_EXISTING === "1";

if (!JWT_SECRET) {
  console.error("JWT_SECRET is missing in environment.");
  process.exit(1);
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const infos of Object.values(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family === "IPv4" && !info.internal && !info.address.startsWith("169.254")) {
        return info.address;
      }
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_err) {
      // keep polling
    }
    await sleep(300);
  }
  return false;
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_err) {
    return text;
  }
}

async function run() {
  const results = [];
  let failures = 0;

  let serverOutput = "";
  let server = null;
  if (!USE_EXISTING_SERVER) {
    server = spawn(process.execPath, ["src/server.js"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT },
      stdio: ["ignore", "pipe", "pipe"],
    });

    server.stdout.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    server.stderr.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
  }

  const stopServer = () => {
    if (!server || server.killed) return;
    server.kill("SIGTERM");
  };

  const request = async (name, method, path, options = {}) => {
    const { token, body, expected = [200] } = options;
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    let parsed;
    let status = 0;

    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      status = response.status;
      parsed = await parseResponseBody(response);
    } catch (err) {
      parsed = { error: err.message };
    }

    const ok = expected.includes(status);
    if (!ok) failures += 1;

    results.push({ ok, name, method, path, status, body: parsed });
    return { ok, status, body: parsed };
  };

  try {
    const ready = await waitForServer(`${BASE_URL}/`);
    if (!ready) {
      throw new Error(`Server did not start on ${BASE_URL}. Output:\n${serverOutput}`);
    }

    const root = await request("Root health", "GET", "/", { expected: [200] });
    const lanIp = getLanIp();
    if (lanIp) {
      const lanStatus = await fetch(`http://${lanIp}:${PORT}/`)
        .then((res) => res.status)
        .catch((err) => `ERR:${err.message}`);
      const lanOk = lanStatus === 200;
      if (!lanOk) failures += 1;
      results.push({
        ok: lanOk,
        name: "LAN health",
        method: "GET",
        path: `http://${lanIp}:${PORT}/`,
        status: lanStatus,
        body: null,
      });
    } else {
      results.push({
        ok: true,
        name: "LAN health",
        method: "GET",
        path: "No LAN IP detected",
        status: 0,
        body: null,
      });
    }

    if (!root.ok) throw new Error("Root endpoint failed.");

    const unique = Date.now();
    const userEmail = `smoke_${unique}@example.com`;
    const userPassword = "SmokePass123!";
    const userName = `Smoke User ${unique}`;
    const userPhone = `06${String(unique).slice(-8)}`;

    const register = await request("User register", "POST", "/api/users/register", {
      body: {
        name: userName,
        email: userEmail,
        phone: userPhone,
        password: userPassword,
      },
      expected: [201],
    });

    const clientToken = register.body?.token;
    const userId = register.body?.user?.id;
    if (!clientToken || !userId) {
      throw new Error("Failed to bootstrap test user/token.");
    }

    const adminToken = jwt.sign({ userId, role: "ADMIN" }, JWT_SECRET, {
      expiresIn: "2h",
    });

    const categoryCreate = await request("Category create", "POST", "/api/categories", {
      token: adminToken,
      body: { name: `Smoke Category ${unique}`, description: "smoke", sortOrder: 10 },
      expected: [201],
    });
    const categoryId = categoryCreate.body?.id;

    await request("Category list", "GET", "/api/categories", { expected: [200] });
    await request("Category get by id", "GET", `/api/categories/${categoryId}`, {
      expected: [200],
    });
    await request("Category update", "PUT", `/api/categories/${categoryId}`, {
      token: adminToken,
      body: { description: "updated smoke category", sortOrder: 11 },
      expected: [200],
    });
    await request("Category deactivate", "PATCH", `/api/categories/${categoryId}/activate`, {
      token: adminToken,
      body: { active: false },
      expected: [200],
    });
    await request("Category reactivate", "PATCH", `/api/categories/${categoryId}/activate`, {
      token: adminToken,
      body: { active: true },
      expected: [200],
    });

    const locationCreate = await request("Location create", "POST", "/api/locations", {
      token: adminToken,
      body: {
        name: `Smoke Location ${unique}`,
        addressLine1: "12 Rue du Test",
        postalCode: "75001",
        city: "Paris",
        country: "France",
        active: true,
      },
      expected: [201],
    });
    const locationId = locationCreate.body?.id;

    await request("Location list", "GET", "/api/locations", { expected: [200] });
    await request("Location get by id", "GET", `/api/locations/${locationId}`, {
      expected: [200],
    });
    await request("Location update", "PUT", `/api/locations/${locationId}`, {
      token: adminToken,
      body: { notes: "updated smoke location" },
      expected: [200],
    });
    await request("Location deactivate", "PATCH", `/api/locations/${locationId}/activate`, {
      token: adminToken,
      body: { active: false },
      expected: [200],
    });
    await request("Location reactivate", "PATCH", `/api/locations/${locationId}/activate`, {
      token: adminToken,
      body: { active: true },
      expected: [200],
    });

    const now = new Date();
    const slotStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    const batchDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const batchDateStr = batchDate.toISOString().slice(0, 10);

    const slotCreate = await request("TimeSlot create", "POST", "/api/timeslots", {
      token: adminToken,
      body: {
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        maxPizzas: 20,
        serviceDate: slotStart.toISOString(),
        locationId,
      },
      expected: [201],
    });
    const slotId = slotCreate.body?.id;

    await request("TimeSlot batch create", "POST", "/api/timeslots/batch", {
      token: adminToken,
      body: {
        serviceDate: batchDateStr,
        startTime: "18:00:00",
        endTime: "20:00:00",
        duration: 30,
        maxPizzas: 15,
        locationId,
      },
      expected: [201],
    });
    await request("TimeSlot list", "GET", "/api/timeslots", { expected: [200] });
    await request("TimeSlot active", "GET", `/api/timeslots/active?locationId=${locationId}`, {
      expected: [200],
    });
    await request("TimeSlot update", "PUT", `/api/timeslots/${slotId}`, {
      token: adminToken,
      body: { maxPizzas: 25, locationId },
      expected: [200],
    });
    await request("TimeSlot activate", "PATCH", `/api/timeslots/${slotId}/activate`, {
      token: adminToken,
      body: { active: true },
      expected: [200],
    });

    const galleryCreate = await request("Gallery create", "POST", "/api/gallery", {
      token: adminToken,
      body: {
        imageUrl: "https://example.com/smoke-image.jpg",
        thumbnailUrl: "https://example.com/smoke-thumb.jpg",
        title: "Smoke image",
        description: "Smoke description",
        sortOrder: 1,
      },
      expected: [201],
    });
    const galleryId = galleryCreate.body?.id;

    await request("Gallery list public", "GET", "/api/gallery", { expected: [200] });
    await request("Gallery list admin", "GET", "/api/gallery/admin/all", {
      token: adminToken,
      expected: [200],
    });
    await request("Gallery get by id", "GET", `/api/gallery/${galleryId}`, {
      expected: [200],
    });
    await request("Gallery update", "PUT", `/api/gallery/${galleryId}`, {
      token: adminToken,
      body: { description: "Updated smoke description" },
      expected: [200],
    });
    await request("Gallery deactivate", "PATCH", `/api/gallery/${galleryId}/activate`, {
      token: adminToken,
      body: { active: false },
      expected: [200],
    });
    await request("Gallery reactivate", "PATCH", `/api/gallery/${galleryId}/activate`, {
      token: adminToken,
      body: { active: true },
      expected: [200],
    });

    await request("Pizza list", "GET", "/api/pizzas", { expected: [200] });
    await request("Ingredient list", "GET", "/api/pizzas/ingredients", { expected: [200] });

    const ingredientCreate = await request(
      "Ingredient create",
      "POST",
      "/api/pizzas/ingredients",
      {
        token: adminToken,
        body: { name: `Smoke Ingredient ${unique}`, price: 1.5, isExtra: true },
        expected: [201],
      }
    );
    const ingredientId = ingredientCreate.body?.id;

    await request("Ingredient update", "PUT", `/api/pizzas/ingredients/${ingredientId}`, {
      token: adminToken,
      body: { price: 2.0 },
      expected: [200],
    });

    const pizzaCreate = await request("Pizza create", "POST", "/api/pizzas", {
      token: adminToken,
      body: {
        name: `Smoke Pizza ${unique}`,
        description: "Smoke pizza",
        basePrice: 12.5,
        categoryId,
      },
      expected: [201],
    });
    const pizzaId = pizzaCreate.body?.id;

    await request("Pizza details", "GET", `/api/pizzas/${pizzaId}/details`, {
      expected: [200],
    });
    await request("Pizza update", "PUT", `/api/pizzas/${pizzaId}`, {
      token: adminToken,
      body: { basePrice: 13.0, categoryId },
      expected: [200],
    });
    await request("Ingredient link to pizza", "POST", "/api/pizzas/ingredients/link", {
      token: adminToken,
      body: { pizzaId, ingredientId },
      expected: [201],
    });
    await request("Ingredient unlink from pizza", "DELETE", "/api/pizzas/ingredients/link", {
      token: adminToken,
      body: { pizzaId, ingredientId },
      expected: [200],
    });

    await request("Order cart get", "GET", "/api/orders/cart", {
      token: clientToken,
      expected: [200],
    });
    const cartAdd1 = await request("Order cart add", "POST", "/api/orders/cart", {
      token: clientToken,
      body: { pizzaId, quantity: 1, customizations: {} },
      expected: [200],
    });
    const firstItemId = cartAdd1.body?.items?.[0]?.id;
    if (firstItemId) {
      await request("Order cart remove item", "DELETE", `/api/orders/cart/${firstItemId}`, {
        token: clientToken,
        expected: [200],
      });
    }
    await request("Order cart add again", "POST", "/api/orders/cart", {
      token: clientToken,
      body: { pizzaId, quantity: 1, customizations: {} },
      expected: [200],
    });
    const finalized = await request("Order finalize", "POST", "/api/orders/finalize", {
      token: clientToken,
      body: { timeSlotId: slotId },
      expected: [200],
    });
    const orderId = finalized.body?.id;

    await request("Order admin list", "GET", "/api/orders", {
      token: adminToken,
      expected: [200],
    });
    await request("Order admin finalize disabled", "PATCH", `/api/orders/${orderId}/status`, {
      token: adminToken,
      body: { status: "FINALIZED" },
      expected: [400],
    });
    await request("Order admin delete", "DELETE", `/api/orders/${orderId}`, {
      token: adminToken,
      expected: [200],
    });

    await request("User login", "POST", "/api/users/login", {
      body: { email: userEmail, password: userPassword },
      expected: [200],
    });
    await request("User me", "GET", "/api/users/me", {
      token: clientToken,
      expected: [200],
    });
    await request("User me update", "PUT", "/api/users/me", {
      token: clientToken,
      body: { name: `${userName} Updated` },
      expected: [200],
    });
    await request("User orders", "GET", "/api/users/orders", {
      token: clientToken,
      expected: [200],
    });
    await request("Admin users list", "GET", "/api/users", {
      token: adminToken,
      expected: [200],
    });
    await request("Admin user by id", "GET", `/api/users/${userId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Admin user role update", "PUT", `/api/users/${userId}/role`, {
      token: adminToken,
      body: { role: "ADMIN" },
      expected: [200],
    });
    await request("User logout", "POST", "/api/users/logout", {
      token: clientToken,
      expected: [200],
    });

    const threadCreate = await request("Message thread create", "POST", "/api/messages/threads", {
      token: clientToken,
      body: { subject: "Smoke subject", content: "First smoke message" },
      expected: [201],
    });
    const threadId = threadCreate.body?.id;

    await request("Message my threads", "GET", "/api/messages/threads/me", {
      token: clientToken,
      expected: [200],
    });
    await request(
      "Message add admin reply",
      "POST",
      `/api/messages/threads/${threadId}/messages`,
      {
        token: adminToken,
        body: { content: "Admin smoke reply" },
        expected: [201],
      }
    );
    await request(
      "Message thread messages",
      "GET",
      `/api/messages/threads/${threadId}/messages`,
      {
        token: clientToken,
        expected: [200],
      }
    );
    await request("Message admin threads", "GET", "/api/messages/admin/threads", {
      token: adminToken,
      expected: [200],
    });
    await request(
      "Message admin close thread",
      "PATCH",
      `/api/messages/admin/threads/${threadId}/status`,
      {
        token: adminToken,
        body: { status: "CLOSED" },
        expected: [200],
      }
    );

    await request("TimeSlot delete by date", "DELETE", `/api/timeslots/date/${batchDateStr}`, {
      token: adminToken,
      expected: [200],
    });
    await request("TimeSlot delete", "DELETE", `/api/timeslots/${slotId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Gallery delete", "DELETE", `/api/gallery/${galleryId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Ingredient delete", "DELETE", `/api/pizzas/ingredients/${ingredientId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Pizza delete", "DELETE", `/api/pizzas/${pizzaId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Category delete", "DELETE", `/api/categories/${categoryId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Location delete", "DELETE", `/api/locations/${locationId}`, {
      token: adminToken,
      expected: [200],
    });
    await request("Admin delete user", "DELETE", `/api/users/${userId}`, {
      token: adminToken,
      expected: [200],
    });

    const passed = results.length - failures;
    console.log(`\nSmoke test finished: ${passed}/${results.length} passed`);
    for (const result of results) {
      const tag = result.ok ? "PASS" : "FAIL";
      console.log(`${tag} | ${result.method.padEnd(6)} ${result.path} -> ${result.status}`);
      if (!result.ok) {
        console.log(`  Response: ${JSON.stringify(result.body)}`);
      }
    }

    process.exitCode = failures === 0 ? 0 : 1;
  } catch (err) {
    failures += 1;
    console.error("Smoke test aborted:", err.message);
    console.error(serverOutput);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

run();
