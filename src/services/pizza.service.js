const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* =========================
   PIZZAS
========================= */

async function getAllPizzas() {
  return prisma.pizza.findMany({
    include: {
      ingredients: {
        include: {
          ingredient: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

async function getPizzaById(id) {
  id = parseInt(id);

  const pizza = await prisma.pizza.findUnique({
    where: { id },
    include: {
      ingredients: {
        include: {
          ingredient: true,
        },
      },
    },
  });

  if (!pizza) throw new Error("Pizza introuvable");

  return pizza;
}

async function createPizza(data) {
  const { name, description, basePrice } = data;

  if (!name || !basePrice) {
    throw new Error("Nom et prix obligatoires");
  }

  return prisma.pizza.create({
    data: {
      name,
      description,
      basePrice: Number(basePrice),
    },
  });
}

async function updatePizza(id, data) {
  id = parseInt(id);

  const pizza = await prisma.pizza.findUnique({ where: { id } });
  if (!pizza) throw new Error("Pizza introuvable");

  return prisma.pizza.update({
    where: { id },
    data: {
      name: data.name ?? pizza.name,
      description: data.description ?? pizza.description,
      basePrice: data.basePrice
        ? Number(data.basePrice)
        : pizza.basePrice,
    },
  });
}

async function deletePizza(id) {
  id = parseInt(id);

  const pizza = await prisma.pizza.findUnique({ where: { id } });
  if (!pizza) throw new Error("Pizza introuvable");

  // Supprimer d'abord les relations pivot
  await prisma.pizzaIngredient.deleteMany({
    where: { pizzaId: id },
  });

  await prisma.pizza.delete({
    where: { id },
  });

  return true;
}

/* =========================
   INGREDIENTS
========================= */

async function getAllIngredients() {
  return prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });
}

async function createIngredient(data) {
  const { name, price } = data;

  if (!name || price === undefined) {
    throw new Error("Nom et prix obligatoires");
  }

  return prisma.ingredient.create({
    data: {
      name,
      price: Number(price),
      isExtra: true,
    },
  });
}


async function updateIngredient(id, data) {
  id = parseInt(id);

  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) throw new Error("Ingrédient introuvable");

  return prisma.ingredient.update({
    where: { id },
    data: {
      name: data.name ?? ingredient.name,
      price: data.price !== undefined ? Number(data.price) : ingredient.price,
      // pas de modification d'isExtra
    },
  });
}

async function deleteIngredient(id) {
  id = parseInt(id);

  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
  });
  if (!ingredient) throw new Error("Ingrédient introuvable");

  // Supprimer relations pivot
  await prisma.pizzaIngredient.deleteMany({
    where: { ingredientId: id },
  });

  await prisma.ingredient.delete({
    where: { id },
  });

  return true;
}

/* =========================
   LIAISON PIZZA / INGREDIENT
========================= */

async function addIngredientToPizza(pizzaId, ingredientId) {
  pizzaId = parseInt(pizzaId);
  ingredientId = parseInt(ingredientId);

  const pizza = await prisma.pizza.findUnique({
    where: { id: pizzaId },
  });
  if (!pizza) throw new Error("Pizza introuvable");

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
  });
  if (!ingredient) throw new Error("Ingrédient introuvable");

  // Vérifier si déjà lié
  const existingLink = await prisma.pizzaIngredient.findFirst({
    where: { pizzaId, ingredientId },
  });

  if (existingLink) {
    throw new Error("Ingrédient déjà lié à cette pizza");
  }

  return prisma.pizzaIngredient.create({
    data: {
      pizzaId,
      ingredientId,
    },
  });
}

async function removeIngredientFromPizza(pizzaId, ingredientId) {
  return prisma.pizzaIngredient.delete({
    where: {
      pizzaId_ingredientId: {
        pizzaId: parseInt(pizzaId),
        ingredientId: parseInt(ingredientId),
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