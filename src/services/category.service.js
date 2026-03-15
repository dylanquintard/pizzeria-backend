const prisma = require("../lib/prisma");

const CATEGORY_KINDS = {
  PRODUCT: "PRODUCT",
  INGREDIENT: "INGREDIENT",
};

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseSortOrder(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("sortOrder must be a positive integer or zero");
  }
  return parsed;
}

function parseOptionalBoolean(value, fieldName = "active") {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName} must be a boolean`);
}

function parseCategoryKind(value, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error("kind is required");
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!CATEGORY_KINDS[normalized]) {
    throw new Error("kind must be PRODUCT or INGREDIENT");
  }

  return CATEGORY_KINDS[normalized];
}

function parseName(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("name is required");
  }
  return value.trim();
}

async function getCategories(filters = {}) {
  const active = parseOptionalBoolean(filters.active);
  const kind = parseCategoryKind(filters.kind, { required: false });
  const where =
    active === undefined && kind === undefined
      ? undefined
      : {
          active: active === undefined ? undefined : active,
          kind: kind === undefined ? undefined : kind,
        };

  return prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

async function getCategoryById(id) {
  const categoryId = parsePositiveInt(id, "id");
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) throw new Error("Category not found");
  return category;
}

async function createCategory(data) {
  const kind = parseCategoryKind(data.kind, { required: false }) || CATEGORY_KINDS.PRODUCT;

  return prisma.category.create({
    data: {
      name: parseName(data.name),
      kind,
      description:
        typeof data.description === "string" && data.description.trim()
          ? data.description.trim()
          : null,
      sortOrder: parseSortOrder(data.sortOrder) ?? 0,
      active: parseOptionalBoolean(data.active) ?? true,
      customerCanCustomize:
        kind === CATEGORY_KINDS.PRODUCT
          ? parseOptionalBoolean(data.customerCanCustomize, "customerCanCustomize") ?? false
          : false,
    },
  });
}

async function updateCategory(id, data) {
  const categoryId = parsePositiveInt(id, "id");
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw new Error("Category not found");

  const nextKind = parseCategoryKind(data.kind, { required: false });

  return prisma.category.update({
    where: { id: categoryId },
    data: {
      name: data.name !== undefined ? parseName(data.name) : undefined,
      kind: nextKind,
      description:
        data.description === undefined
          ? undefined
          : typeof data.description === "string" && data.description.trim()
            ? data.description.trim()
            : null,
      sortOrder: parseSortOrder(data.sortOrder),
      active: parseOptionalBoolean(data.active),
      customerCanCustomize:
        existing.kind === CATEGORY_KINDS.PRODUCT || nextKind === CATEGORY_KINDS.PRODUCT
          ? parseOptionalBoolean(data.customerCanCustomize, "customerCanCustomize")
          : false,
    },
  });
}

async function activateCategory(id, active) {
  const categoryId = parsePositiveInt(id, "id");
  return prisma.category.update({
    where: { id: categoryId },
    data: { active: parseOptionalBoolean(active) ?? false },
  });
}

async function deleteCategory(id) {
  const categoryId = parsePositiveInt(id, "id");
  return prisma.category.delete({
    where: { id: categoryId },
  });
}

module.exports = {
  CATEGORY_KINDS,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  activateCategory,
  deleteCategory,
};
