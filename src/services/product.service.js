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

function parseNullablePositiveInt(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parsePositiveInt(value, fieldName);
}

function parseDecimal(value, fieldName) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid positive number`);
  }
  return parsed;
}

function parseOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName} must be a boolean`);
}

async function ensureCategoryKind(categoryId, expectedKind) {
  if (categoryId === null || categoryId === undefined) return;

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Category not found");
  if (category.kind !== expectedKind) {
    throw new Error(`Category kind must be ${expectedKind}`);
  }
}

async function getAllProducts(filters = {}) {
  const categoryId = parseNullablePositiveInt(filters.categoryId, "categoryId");

  return prisma.product.findMany({
    where: {
      categoryId: categoryId === undefined ? undefined : categoryId,
    },
    include: {
      category: true,
      ingredients: {
        include: { ingredient: { include: { category: true } } },
      },
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });
}

async function getProductById(id) {
  const productId = parsePositiveInt(id, "id");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      ingredients: {
        include: { ingredient: { include: { category: true } } },
      },
    },
  });

  if (!product) throw new Error("Product not found");
  return product;
}

async function createProduct(data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("name is required");
  const categoryId = parseNullablePositiveInt(data.categoryId, "categoryId");

  if (categoryId) {
    await ensureCategoryKind(categoryId, CATEGORY_KINDS.PRODUCT);
  }

  return prisma.product.create({
    data: {
      name,
      description: typeof data.description === "string" ? data.description.trim() : "",
      basePrice: parseDecimal(data.basePrice, "basePrice"),
      categoryId,
    },
    include: { category: true },
  });
}

async function updateProduct(id, data) {
  const productId = parsePositiveInt(id, "id");
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new Error("Product not found");
  const categoryId = parseNullablePositiveInt(data.categoryId, "categoryId");

  if (categoryId) {
    await ensureCategoryKind(categoryId, CATEGORY_KINDS.PRODUCT);
  }

  return prisma.product.update({
    where: { id: productId },
    data: {
      name: typeof data.name === "string" ? data.name.trim() : undefined,
      description:
        typeof data.description === "string" ? data.description.trim() : undefined,
      basePrice:
        data.basePrice !== undefined
          ? parseDecimal(data.basePrice, "basePrice")
          : undefined,
      categoryId,
    },
    include: { category: true },
  });
}

async function deleteProduct(id) {
  const productId = parsePositiveInt(id, "id");

  await prisma.$transaction([
    prisma.productIngredient.deleteMany({ where: { productId } }),
    prisma.product.delete({ where: { id: productId } }),
  ]);

  return true;
}

async function getAllIngredients(filters = {}) {
  const categoryId = parseNullablePositiveInt(filters.categoryId, "categoryId");
  const isExtra = parseOptionalBoolean(filters.isExtra, "isExtra");

  return prisma.ingredient.findMany({
    where: {
      categoryId: categoryId === undefined ? undefined : categoryId,
      isExtra: isExtra === undefined ? undefined : isExtra,
    },
    include: {
      category: true,
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });
}

async function createIngredient(data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("name is required");
  const categoryId = parseNullablePositiveInt(data.categoryId, "categoryId");

  if (categoryId) {
    await ensureCategoryKind(categoryId, CATEGORY_KINDS.INGREDIENT);
  }

  return prisma.ingredient.create({
    data: {
      name,
      price: parseDecimal(data.price, "price"),
      isExtra: data.isExtra === undefined ? true : Boolean(data.isExtra),
      categoryId,
    },
    include: {
      category: true,
    },
  });
}

async function updateIngredient(id, data) {
  const ingredientId = parsePositiveInt(id, "id");

  const existing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!existing) throw new Error("Ingredient not found");
  const categoryId = parseNullablePositiveInt(data.categoryId, "categoryId");

  if (categoryId) {
    await ensureCategoryKind(categoryId, CATEGORY_KINDS.INGREDIENT);
  }

  return prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      name: typeof data.name === "string" ? data.name.trim() : undefined,
      price: data.price !== undefined ? parseDecimal(data.price, "price") : undefined,
      isExtra: typeof data.isExtra === "boolean" ? data.isExtra : undefined,
      categoryId,
    },
    include: {
      category: true,
    },
  });
}

async function deleteIngredient(id) {
  const ingredientId = parsePositiveInt(id, "id");

  await prisma.$transaction([
    prisma.productIngredient.deleteMany({ where: { ingredientId } }),
    prisma.ingredient.delete({ where: { id: ingredientId } }),
  ]);

  return true;
}

async function addIngredientToProduct(productId, ingredientId) {
  const parsedProductId = parsePositiveInt(productId, "productId");
  const parsedIngredientId = parsePositiveInt(ingredientId, "ingredientId");

  await prisma.product.findUniqueOrThrow({ where: { id: parsedProductId } });
  await prisma.ingredient.findUniqueOrThrow({ where: { id: parsedIngredientId } });

  try {
    return await prisma.productIngredient.create({
      data: {
        productId: parsedProductId,
        ingredientId: parsedIngredientId,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw new Error("Ingredient already linked to this product");
    }
    throw err;
  }
}

async function removeIngredientFromProduct(productId, ingredientId) {
  return prisma.productIngredient.delete({
    where: {
      productId_ingredientId: {
        productId: parsePositiveInt(productId, "productId"),
        ingredientId: parsePositiveInt(ingredientId, "ingredientId"),
      },
    },
  });
}

module.exports = {
  CATEGORY_KINDS,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  addIngredientToProduct,
  removeIngredientFromProduct,
};
