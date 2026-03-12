const prisma = require("../lib/prisma");
const { FRONTEND_SITE_URL } = require("../lib/env");
const { BLOG_SLUGS } = require("../seo/blogSlugs");

const SPECIAL_CITY_PATHS = {
  thionville: "/pizza-napolitaine-thionville",
  metz: "/pizza-napolitaine-metz",
  moselle: "/food-truck-pizza-moselle",
};

const STATIC_PATHS = [
  "/",
  "/menu",
  "/planing",
  "/a-propos",
  "/contact",
  "/blog",
  "/pizza-napolitaine-thionville",
  "/pizza-napolitaine-metz",
  "/food-truck-pizza-moselle",
];

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCityPath(cityName) {
  const slug = slugify(cityName);
  if (!slug) return "";
  return SPECIAL_CITY_PATHS[slug] || `/pizza-${slug}`;
}

function buildCitySlug(cityName) {
  return slugify(cityName);
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toIsoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function renderUrlTag(baseUrl, entry) {
  const url = `${baseUrl}${entry.path}`;
  return [
    "  <url>",
    `    <loc>${xmlEscape(url)}</loc>`,
    "  </url>",
  ].join("\n");
}

async function getSeoLocationCatalog() {
  const locations = await prisma.location.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      city: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  const pathToEntry = new Map();

  for (const location of locations) {
    const candidates = [location?.city, location?.name].filter(Boolean);
    for (const candidate of candidates) {
      const slug = buildCitySlug(candidate);
      const path = buildCityPath(candidate);
      if (!path) continue;
      if (!slug) continue;

      const lastmod = toIsoDate(location.updatedAt);
      const label = String(candidate).trim();
      if (!pathToEntry.has(path)) {
        pathToEntry.set(path, {
          locationId: Number(location.id),
          slug,
          path,
          label,
          lastmod,
        });
        continue;
      }

      const existing = pathToEntry.get(path);
      const shouldReplace =
        !existing.lastmod ||
        (lastmod && existing.lastmod < lastmod) ||
        (!existing.label && label);
      if (shouldReplace) {
        pathToEntry.set(path, {
          locationId: Number(location.id),
          slug,
          path,
          label,
          lastmod,
        });
      }
    }
  }

  return [...pathToEntry.values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function buildSitemapXml() {
  const baseUrl = normalizeBaseUrl(FRONTEND_SITE_URL);
  const staticEntries = STATIC_PATHS.map((path) => ({ path }));
  const blogEntries = BLOG_SLUGS.map((slug) => ({ path: `/blog/${slug}` }));
  const dynamicEntries = await getSeoLocationCatalog();

  const deduped = new Map();
  for (const entry of [...staticEntries, ...blogEntries, ...dynamicEntries]) {
    if (!entry.path) continue;
    if (!deduped.has(entry.path)) {
      deduped.set(entry.path, entry);
      continue;
    }
    const existing = deduped.get(entry.path);
    if (!existing.lastmod && entry.lastmod) {
      deduped.set(entry.path, entry);
    }
  }

  const entries = [...deduped.values()].sort((a, b) => a.path.localeCompare(b.path));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) => renderUrlTag(baseUrl, entry)),
    "</urlset>",
    "",
  ].join("\n");

  return xml;
}

module.exports = {
  buildSitemapXml,
  getSeoLocationCatalog,
};
