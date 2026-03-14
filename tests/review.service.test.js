const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../src/lib/prisma");
const reviewService = require("../src/services/review.service");

test("reviews are rejected when the order is not validated", async () => {
  const originalFindUnique = prisma.order.findUnique;

  prisma.order.findUnique = async () => ({
    id: 42,
    userId: 7,
    status: "FINALIZED",
    review: null,
  });

  try {
    await assert.rejects(
      () =>
        reviewService.upsertOrderReview(7, 42, {
          rating: 5,
          comment: "Commande tres bonne et retrait tres fluide.",
        }),
      /Only validated orders can be reviewed/
    );
  } finally {
    prisma.order.findUnique = originalFindUnique;
  }
});

test("reviews are rejected when the order belongs to another user", async () => {
  const originalFindUnique = prisma.order.findUnique;

  prisma.order.findUnique = async () => ({
    id: 42,
    userId: 9,
    status: "VALIDATE",
    review: null,
  });

  try {
    await assert.rejects(
      () =>
        reviewService.upsertOrderReview(7, 42, {
          rating: 5,
          comment: "Commande tres bonne et retrait tres fluide.",
        }),
      /Order not found/
    );
  } finally {
    prisma.order.findUnique = originalFindUnique;
  }
});

test("validated orders create a review", async () => {
  const originalFindUnique = prisma.order.findUnique;
  const originalCreate = prisma.orderReview.create;

  prisma.order.findUnique = async () => ({
    id: 42,
    userId: 7,
    status: "VALIDATE",
    review: null,
  });

  prisma.orderReview.create = async ({ data }) => ({
    id: 12,
    orderId: data.orderId,
    userId: data.userId,
    rating: data.rating,
    comment: data.comment,
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
  });

  try {
    const review = await reviewService.upsertOrderReview(7, 42, {
      rating: 5,
      comment: "Commande tres bonne et retrait tres fluide.",
    });

    assert.equal(review.orderId, 42);
    assert.equal(review.userId, 7);
    assert.equal(review.rating, 5);
  } finally {
    prisma.order.findUnique = originalFindUnique;
    prisma.orderReview.create = originalCreate;
  }
});
