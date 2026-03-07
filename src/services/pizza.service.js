const prisma = require("../lib/prisma");

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

async function getAllPizzas(filters = {}) {
  const categoryId = parseNullablePositiveInt(filters.categoryId, "categoryId");

  return prisma.pizza.findMany({
    where: {
      categoryId: categoryId === undefined ? undefined : categoryId,
    },
    include: {
      category: true,
      ingredients: {
        include: { ingredient: true },
      },
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });
}

async function getPizzaById(id) {
  const pizzaId = parsePositiveInt(id, "id");

  const pizza = await prisma.pizza.findUnique({
    where: { id: pizzaId },
    include: {
      category: true,
      ingredients: {
        include: { ingredient: true },
      },
    },
  });

  if (!pizza) throw new Error("Pizza not found");
  return pizza;
}

async function createPizza(data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("name is required");
  const categoryId = parseNullablePositiveInt(data.categoryId, "categoryId");

  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new Error("Category not found");
  }

  return prisma.pizza.create({
    data: {
      name,
      description: typeof data.description === "string" ? data.description.trim() : "",
      basePrice: parseDecimal(data.basePrice, "basePrice"),
      categoryId,
    },
    include: { category: true },
  });
}

async function updatePizza(id, data) {
  const pizzaId = parsePositiveInt(id, "id");
  const existing = await prisma.pizza.findUnique({ where: { id: pizzaId } });
  if (!existing) throw new Error("Pizza not found");
  const categoryId = parseNullablePositiveInt(data.categoryId, "categoryId");

  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new Error("Category not found");
  }

  return prisma.pizza.update({
    where: { id: pizzaId },
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

async function deletePizza(id) {
  const pizzaId = parsePositiveInt(id, "id");

  await prisma.$transaction([
    prisma.pizzaIngredient.deleteMany({ where: { pizzaId } }),
    prisma.pizza.delete({ where: { id: pizzaId } }),
  ]);

  return true;
}

async function getAllIngredients() {
  return prisma.ingredient.findMany({ orderBy: { name: "asc" } });
}

async function createIngredient(data) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error("name is required");

  return prisma.ingredient.create({
    data: {
      name,
      price: parseDecimal(data.price, "price"),
      isExtra: data.isExtra === undefined ? true : Boolean(data.isExtra),
    },
  });
}

async function updateIngredient(id, data) {
  const ingredientId = parsePositiveInt(id, "id");

  const existing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!existing) throw new Error("Ingredient not found");

  return prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      name: typeof data.name === "string" ? data.name.trim() : undefined,
      price: data.price !== undefined ? parseDecimal(data.price, "price") : undefined,
      isExtra: typeof data.isExtra === "boolean" ? data.isExtra : undefined,
    },
  });
}

async function deleteIngredient(id) {
  const ingredientId = parsePositiveInt(id, "id");

  await prisma.$transaction([
    prisma.pizzaIngredient.deleteMany({ where: { ingredientId } }),
    prisma.ingredient.delete({ where: { id: ingredientId } }),
  ]);

  return true;
}

async function addIngredientToPizza(pizzaId, ingredientId) {
  const parsedPizzaId = parsePositiveInt(pizzaId, "pizzaId");
  const parsedIngredientId = parsePositiveInt(ingredientId, "ingredientId");

  await prisma.pizza.findUniqueOrThrow({ where: { id: parsedPizzaId } });
  await prisma.ingredient.findUniqueOrThrow({ where: { id: parsedIngredientId } });

  try {
    return await prisma.pizzaIngredient.create({
      data: {
        pizzaId: parsedPizzaId,
        ingredientId: parsedIngredientId,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw new Error("Ingredient already linked to this pizza");
    }
    throw err;
  }
}

async function removeIngredientFromPizza(pizzaId, ingredientId) {
  return prisma.pizzaIngredient.delete({
    where: {
      pizzaId_ingredientId: {
        pizzaId: parsePositiveInt(pizzaId, "pizzaId"),
        ingredientId: parsePositiveInt(ingredientId, "ingredientId"),
      },
    },
  });
}

module.exports = {
  getAllPizzas,
  getPizzaById,
  createPizza,
  updatePizza,
  deletePizza,
  getAllIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  addIngredientToPizza,
  removeIngredientFromPizza,
};
