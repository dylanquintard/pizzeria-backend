const prisma = require("../lib/prisma");
const { normalizeCustomizations } = require("../utils/customizations");

const CATEGORY_KINDS = {
  PRODUCT: "PRODUCT",
  INGREDIENT: "INGREDIENT",
};
const DELETED_PRODUCT_SNAPSHOT_TTL_DAYS = 10;

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

function parseBooleanWithDefault(value, defaultValue = false) {
  const parsed = parseOptionalBoolean(value, "value");
  return parsed === undefined ? defaultValue : parsed;
}

function toIsoPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildDeletedProductSnapshot(product) {
  return {
    originalProductId: product.id,
    name: product.name,
    basePrice: Number(product.basePrice),
    categoryName: product.category?.name || null,
    deletedAt: new Date().toISOString(),
    expiresAt: toIsoPlusDays(DELETED_PRODUCT_SNAPSHOT_TTL_DAYS),
  };
}

function mergeCustomizationsWithDeletedSnapshot(customizations, snapshot) {
  return {
    ...normalizeCustomizations(customizations || {}),
    deletedProductSnapshot: snapshot,
  };
}

async function recalculateOrderTotal(client, orderId) {
  const items = await client.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, unitPrice: true },
  });

  const total = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity || 0),
    0
  );

  await client.order.update({
    where: { id: orderId },
    data: { total },
  });
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
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });
  if (!product) throw new Error("Product not found");
  const deletedSnapshot = buildDeletedProductSnapshot(product);

  try {
    await prisma.$transaction(async (tx) => {
      const linkedOrderItems = await tx.orderItem.findMany({
        where: { productId },
        select: {
          id: true,
          orderId: true,
          customizations: true,
          order: { select: { status: true } },
        },
      });

      const pendingOrderItemIds = [];
      const pendingOrderIds = new Set();
      const historyOrderItems = [];

      for (const item of linkedOrderItems) {
        if (item.order?.status === "PENDING") {
          pendingOrderItemIds.push(item.id);
          pendingOrderIds.add(item.orderId);
        } else {
          historyOrderItems.push(item);
        }
      }

      if (pendingOrderItemIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { id: { in: pendingOrderItemIds } },
        });

        for (const orderId of pendingOrderIds) {
          await recalculateOrderTotal(tx, orderId);
        }
      }

      for (const item of historyOrderItems) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            customizations: mergeCustomizationsWithDeletedSnapshot(
              item.customizations,
              deletedSnapshot
            ),
          },
        });
      }

      await tx.productIngredient.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });
    });
  } catch (err) {
    if (err?.code === "P2003") {
      throw new Error(
        "La suppression forcee du produit a echoue. Verifiez que la migration Prisma est bien appliquee."
      );
    }
    throw err;
  }

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

async function addIngredientToProduct(productId, ingredientId, data = {}) {
  const parsedProductId = parsePositiveInt(productId, "productId");
  const parsedIngredientId = parsePositiveInt(ingredientId, "ingredientId");

  await prisma.product.findUniqueOrThrow({ where: { id: parsedProductId } });
  await prisma.ingredient.findUniqueOrThrow({ where: { id: parsedIngredientId } });

  try {
    return await prisma.productIngredient.create({
      data: {
        productId: parsedProductId,
        ingredientId: parsedIngredientId,
        isBase: parseBooleanWithDefault(data.isBase, false),
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw new Error("Ingredient already linked to this product");
    }
    throw err;
  }
}

async function updateIngredientLinkOnProduct(productId, ingredientId, data = {}) {
  const parsedProductId = parsePositiveInt(productId, "productId");
  const parsedIngredientId = parsePositiveInt(ingredientId, "ingredientId");

  return prisma.productIngredient.update({
    where: {
      productId_ingredientId: {
        productId: parsedProductId,
        ingredientId: parsedIngredientId,
      },
    },
    data: {
      isBase: parseBooleanWithDefault(data.isBase, false),
    },
  });
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
  updateIngredientLinkOnProduct,
  removeIngredientFromProduct,
};
