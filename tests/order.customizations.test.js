const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildRemovedBaseIngredientsByCategory,
  calculateCustomizationExtrasTotal,
} = require("../src/services/order.service");

test("removed base lookup includes linked ingredients marked via ingredient base flag", () => {
  const removed = buildRemovedBaseIngredientsByCategory(
    [
      {
        ingredientId: 10,
        isBase: false,
        ingredient: {
          id: 10,
          categoryId: 1,
          isBaseIngredient: true,
        },
      },
    ],
    [10]
  );

  assert.deepEqual(removed.get("1"), [10]);
});

test("base ingredient replacement does not increase total even if replacement is flagged as extra", () => {
  const removedBaseIngredientsByCategory = new Map([
    [
      "1",
      [10],
    ],
  ]);

  const extrasTotal = calculateCustomizationExtrasTotal(
    [
      {
        id: 20,
        categoryId: 1,
        isBaseIngredient: true,
        isExtra: true,
        price: 2,
      },
    ],
    removedBaseIngredientsByCategory
  );

  assert.equal(extrasTotal, 0);
});

test("real extras still increase total", () => {
  const extrasTotal = calculateCustomizationExtrasTotal(
    [
      {
        id: 21,
        categoryId: 2,
        isBaseIngredient: false,
        isExtra: true,
        price: 2,
      },
    ],
    new Map()
  );

  assert.equal(extrasTotal, 2);
});
