const prisma = require("../lib/prisma");

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

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("active must be a boolean");
}

function parseName(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("name is required");
  }
  return value.trim();
}

async function getCategories(filters = {}) {
  const active = parseOptionalBoolean(filters.active);
  const where = active === undefined ? undefined : { active };

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
  return prisma.category.create({
    data: {
      name: parseName(data.name),
      description:
        typeof data.description === "string" && data.description.trim()
          ? data.description.trim()
          : null,
      sortOrder: parseSortOrder(data.sortOrder) ?? 0,
      active: parseOptionalBoolean(data.active) ?? true,
    },
  });
}

async function updateCategory(id, data) {
  const categoryId = parsePositiveInt(id, "id");
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw new Error("Category not found");

  return prisma.category.update({
    where: { id: categoryId },
    data: {
      name: data.name !== undefined ? parseName(data.name) : undefined,
      description:
        data.description === undefined
          ? undefined
          : typeof data.description === "string" && data.description.trim()
            ? data.description.trim()
            : null,
      sortOrder: parseSortOrder(data.sortOrder),
      active: parseOptionalBoolean(data.active),
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
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  activateCategory,
  deleteCategory,
};
