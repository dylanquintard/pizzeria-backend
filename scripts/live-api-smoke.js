/* eslint-disable no-console */
require("dotenv").config();

const { URL } = require("node:url");

const apiBaseUrl = String(
  process.env.SMOKE_API_URL ||
    process.argv[2] ||
    (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : "")
).trim().replace(/\/+$/, "");

if (!apiBaseUrl) {
  console.error("Missing API base URL. Use SMOKE_API_URL or pass it as the first argument.");
  process.exit(1);
}

const checks = [
  { name: "API root", path: "/", expectedStatus: 200, contains: "API Pizzeria running" },
  { name: "Public products", path: "/api/products", expectedStatus: 200, expectJson: true },
  { name: "Public ingredients", path: "/api/products/ingredients", expectedStatus: 200, expectJson: true },
  { name: "Public categories", path: "/api/categories", expectedStatus: 200, expectJson: true },
  { name: "Public locations", path: "/api/locations", expectedStatus: 200, expectJson: true },
  { name: "Public gallery", path: "/api/gallery", expectedStatus: 200, expectJson: true },
  { name: "Public blog list", path: "/api/blog", expectedStatus: 200, expectJson: true },
  { name: "Public FAQ", path: "/api/faqs/public?path=%2F", expectedStatus: 200, expectJson: true },
  { name: "Public reviews", path: "/api/reviews/public", expectedStatus: 200, expectJson: true },
  { name: "Public site settings", path: "/api/site-settings/public", expectedStatus: 200, expectJson: true },
  { name: "Public weekly timeslots", path: "/api/timeslots/public-weekly-settings", expectedStatus: 200, expectJson: true },
  { name: "SEO blog slugs", path: "/api/seo/blog-slugs", expectedStatus: 200, expectJson: true },
  { name: "SEO blog articles", path: "/api/seo/blog-articles", expectedStatus: 200, expectJson: true },
  { name: "SEO locations", path: "/api/seo/locations", expectedStatus: 200, expectJson: true },
  { name: "Sitemap", path: "/sitemap.xml", expectedStatus: 200, contains: "<urlset" },
  { name: "User me guarded", path: "/api/users/me", expectedStatus: 401 },
  { name: "User orders guarded", path: "/api/users/orders", expectedStatus: 401 },
  { name: "Cart guarded", path: "/api/orders/cart", expectedStatus: 401 },
  { name: "Orders admin guarded", path: "/api/orders", expectedStatus: 401 },
  { name: "Timeslot availability guarded", path: "/api/timeslots/availability", expectedStatus: 401 },
  { name: "Site settings admin guarded", path: "/api/site-settings/admin", expectedStatus: 401 },
  { name: "FAQ admin guarded", path: "/api/faqs/admin", expectedStatus: 401 },
  { name: "Blog admin guarded", path: "/api/blog/admin/all", expectedStatus: 401 },
  { name: "Print admin guarded", path: "/api/print/admin/overview", expectedStatus: 401 },
];

async function fetchText(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/html, application/xml;q=0.9, text/xml;q=0.9",
    },
  });

  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
  };
}

async function runCheck(check) {
  const url = new URL(check.path, apiBaseUrl).toString();
  const result = await fetchText(url);
  const contentType = String(result.headers.get("content-type") || "").toLowerCase();

  if (result.status !== check.expectedStatus) {
    throw new Error(`expected ${check.expectedStatus}, got ${result.status}`);
  }

  if (check.expectJson && !contentType.includes("application/json")) {
    throw new Error(`expected JSON response, got "${contentType || "unknown"}"`);
  }

  if (check.contains && !String(result.text || "").includes(check.contains)) {
    throw new Error(`expected response to contain "${check.contains}"`);
  }

  return {
    name: check.name,
    status: result.status,
    path: check.path,
  };
}

async function main() {
  const results = [];
  let failures = 0;

  for (const check of checks) {
    try {
      const result = await runCheck(check);
      results.push({ ok: true, ...result });
    } catch (error) {
      failures += 1;
      results.push({
        ok: false,
        name: check.name,
        path: check.path,
        error: error.message,
      });
    }
  }

  console.log(`API smoke check on ${apiBaseUrl}`);
  for (const result of results) {
    if (result.ok) {
      console.log(`PASS | ${String(result.status).padEnd(3)} | ${result.name} | ${result.path}`);
      continue;
    }
    console.log(`FAIL | --- | ${result.name} | ${result.path}`);
    console.log(`       ${result.error}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} API check(s) failed.`);
    process.exit(1);
  }

  console.log(`\n${results.length}/${results.length} API checks passed.`);
}

main().catch((error) => {
  console.error(`Smoke check aborted: ${error.message}`);
  process.exit(1);
});
