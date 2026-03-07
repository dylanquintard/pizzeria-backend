function normalizeIdArray(values) {
  if (!Array.isArray(values)) return [];

  const unique = new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  );

  return [...unique].sort((a, b) => a - b);
}

function normalizeCustomizations(customizations = {}) {
  const addedIngredients = normalizeIdArray(customizations.addedIngredients);
  const removedIngredients = normalizeIdArray(customizations.removedIngredients).filter(
    (id) => !addedIngredients.includes(id)
  );

  return {
    addedIngredients,
    removedIngredients,
  };
}

module.exports = {
  normalizeIdArray,
  normalizeCustomizations,
};
