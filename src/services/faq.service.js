const prisma = require("../lib/prisma");
const { FRONTEND_SITE_URL } = require("../lib/env");
const blogService = require("./blog.service");
const seoService = require("./seo.service");

const STATIC_FAQ_TARGETS = Object.freeze([
  { path: "/", label: "Accueil", type: "static" },
  { path: "/a-propos", label: "A propos", type: "static" },
  { path: "/blog", label: "Blog", type: "static" },
  { path: "/contact", label: "Contact", type: "static" },
  { path: "/food-truck-pizza-moselle", label: "Food truck pizza Moselle", type: "static" },
  { path: "/menu", label: "Menu", type: "static" },
  { path: "/pizza-napolitaine-thionville", label: "Pizza napolitaine Thionville", type: "static" },
  { path: "/planing", label: "Horaires d'ouvertures", type: "static" },
]);

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeTargetPath(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "/";

  try {
    if (/^https?:\/\//i.test(rawValue)) {
      const parsedUrl = new URL(rawValue);
      return normalizeTargetPath(parsedUrl.pathname);
    }
  } catch (_err) {
    // Fall back to plain string normalization.
  }

  const prefixed = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
  const normalized = prefixed.replace(/\/+$/, "") || "/";
  return normalized === "/" ? "/" : normalized.toLowerCase();
}

function normalizeString(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null) return "";
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  return value.trim();
}

function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("sortOrder must be a positive integer or zero");
  }
  return parsed;
}

function formatFaqEntry(record) {
  return {
    id: Number(record.id),
    targetPath: normalizeTargetPath(record.targetPath),
    question: String(record.question || ""),
    answer: String(record.answer || ""),
    sortOrder: Number(record.sortOrder || 0),
    active: Boolean(record.active),
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function buildPublicUrl(path) {
  const baseUrl = normalizeBaseUrl(FRONTEND_SITE_URL);
  return `${baseUrl}${normalizeTargetPath(path)}`;
}

async function getPublicFaqEntries(path) {
  const targetPath = normalizeTargetPath(path);
  const records = await prisma.pageFaq.findMany({
    where: {
      targetPath,
      active: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  return records.map(formatFaqEntry);
}

async function getAdminFaqEntries(path) {
  const targetPath = normalizeTargetPath(path);
  const records = await prisma.pageFaq.findMany({
    where: { targetPath },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  return {
    path: targetPath,
    absoluteUrl: buildPublicUrl(targetPath),
    items: records.map(formatFaqEntry),
  };
}

async function getAdminFaqTargets() {
  const [blogTargets, locationTargets, groupedCounts] = await Promise.all([
    blogService.getSeoBlogArticles(),
    seoService.getSeoLocationCatalog(),
    prisma.pageFaq.groupBy({
      by: ["targetPath"],
      _count: {
        _all: true,
      },
    }),
  ]);

  const countByPath = new Map(
    groupedCounts.map((entry) => [normalizeTargetPath(entry.targetPath), Number(entry._count?._all || 0)])
  );

  const targetMap = new Map();

  const registerTarget = (entry) => {
    const path = normalizeTargetPath(entry?.path);
    if (!path) return;
    if (targetMap.has(path)) return;

    targetMap.set(path, {
      path,
      label: String(entry?.label || entry?.title || path).trim() || path,
      type: String(entry?.type || "static"),
      absoluteUrl: buildPublicUrl(path),
      faqCount: countByPath.get(path) || 0,
    });
  };

  for (const target of STATIC_FAQ_TARGETS) {
    registerTarget(target);
  }

  for (const article of blogTargets) {
    registerTarget({
      path: article.path,
      label: article.title,
      type: "blog",
    });
  }

  for (const location of locationTargets) {
    registerTarget({
      path: location.path,
      label: location.label || location.slug,
      type: "location",
    });
  }

  for (const [path, count] of countByPath.entries()) {
    if (!targetMap.has(path)) {
      targetMap.set(path, {
        path,
        label: path,
        type: "custom",
        absoluteUrl: buildPublicUrl(path),
        faqCount: count,
      });
    }
  }

  return [...targetMap.values()].sort((left, right) => left.path.localeCompare(right.path, "fr"));
}

async function createFaqEntry(payload) {
  const targetPath = normalizeTargetPath(payload?.targetPath);
  const question = normalizeString(payload?.question, "question");
  const answer = normalizeString(payload?.answer, "answer");
  const sortOrder = normalizeSortOrder(payload?.sortOrder);
  const active = payload?.active === undefined ? true : Boolean(payload.active);

  if (!question) {
    throw new Error("question is required");
  }

  if (!answer) {
    throw new Error("answer is required");
  }

  const created = await prisma.pageFaq.create({
    data: {
      targetPath,
      question,
      answer,
      sortOrder,
      active,
    },
  });

  return formatFaqEntry(created);
}

async function updateFaqEntry(id, payload) {
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    throw new Error("Invalid FAQ id");
  }

  const existing = await prisma.pageFaq.findUnique({
    where: { id: faqId },
  });

  if (!existing) {
    throw new Error("FAQ not found");
  }

  const question =
    payload?.question !== undefined
      ? normalizeString(payload.question, "question")
      : String(existing.question || "");
  const answer =
    payload?.answer !== undefined
      ? normalizeString(payload.answer, "answer")
      : String(existing.answer || "");

  if (!question) {
    throw new Error("question is required");
  }

  if (!answer) {
    throw new Error("answer is required");
  }

  const updated = await prisma.pageFaq.update({
    where: { id: faqId },
    data: {
      targetPath:
        payload?.targetPath !== undefined
          ? normalizeTargetPath(payload.targetPath)
          : normalizeTargetPath(existing.targetPath),
      question,
      answer,
      sortOrder:
        payload?.sortOrder !== undefined
          ? normalizeSortOrder(payload.sortOrder)
          : Number(existing.sortOrder || 0),
      active:
        payload?.active !== undefined ? Boolean(payload.active) : Boolean(existing.active),
    },
  });

  return formatFaqEntry(updated);
}

async function deleteFaqEntry(id) {
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    throw new Error("Invalid FAQ id");
  }

  await prisma.pageFaq.delete({
    where: { id: faqId },
  });
}

module.exports = {
  getPublicFaqEntries,
  getAdminFaqEntries,
  getAdminFaqTargets,
  createFaqEntry,
  updateFaqEntry,
  deleteFaqEntry,
};
