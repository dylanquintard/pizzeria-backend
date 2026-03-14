const prisma = require("../lib/prisma");

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseRating(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("rating must be an integer between 1 and 5");
  }
  return parsed;
}

function parseComment(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("comment is required");
  }
  if (normalized.length < 10) {
    throw new Error("comment must contain at least 10 characters");
  }
  if (normalized.length > 1500) {
    throw new Error("comment is too long");
  }
  return normalized;
}

function formatReview(review) {
  if (!review) return null;

  return {
    id: review.id,
    orderId: review.orderId,
    userId: review.userId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function buildReviewerLabel(user) {
  const firstName = String(user?.firstName || "").trim();
  const name = String(user?.name || "").trim();

  if (firstName) {
    return firstName;
  }

  if (!name) return "Client";

  const [head, ...rest] = name.split(/\s+/).filter(Boolean);
  if (!head) return "Client";
  if (rest.length === 0) return head;
  return `${head} ${rest[0].charAt(0).toUpperCase()}.`;
}

async function upsertOrderReview(userId, orderId, payload = {}) {
  const parsedUserId = parsePositiveInt(userId, "userId");
  const parsedOrderId = parsePositiveInt(orderId, "orderId");
  const rating = parseRating(payload.rating);
  const comment = parseComment(payload.comment);

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId },
    select: {
      id: true,
      userId: true,
      status: true,
      review: {
        select: {
          id: true,
          orderId: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!order || order.userId !== parsedUserId) {
    throw new Error("Order not found");
  }

  if (String(order.status || "").toUpperCase() !== "FINALIZED") {
    throw new Error("Only finalized orders can be reviewed");
  }

  if (order.review) {
    const updated = await prisma.orderReview.update({
      where: { orderId: parsedOrderId },
      data: {
        rating,
        comment,
      },
    });

    return formatReview(updated);
  }

  const created = await prisma.orderReview.create({
    data: {
      orderId: parsedOrderId,
      userId: parsedUserId,
      rating,
      comment,
    },
  });

  return formatReview(created);
}

async function getPublicReviews(options = {}) {
  const requestedLimit = Number(options.limit);
  const take = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 12)
    : 6;

  const reviews = await prisma.orderReview.findMany({
    where: {
      order: {
        status: "FINALIZED",
      },
    },
    include: {
      user: {
        select: {
          name: true,
          firstName: true,
        },
      },
      order: {
        select: {
          timeSlot: {
            select: {
              location: {
                select: {
                  name: true,
                  city: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const aggregate = await prisma.orderReview.aggregate({
    where: {
      order: {
        status: "FINALIZED",
      },
    },
    _avg: {
      rating: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    summary: {
      averageRating: Number(aggregate._avg.rating || 0),
      totalReviews: Number(aggregate._count.id || 0),
    },
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      customerLabel: buildReviewerLabel(review.user),
      locationLabel:
        String(
          review.order?.timeSlot?.location?.city ||
            review.order?.timeSlot?.location?.name ||
            ""
        ).trim() || null,
    })),
  };
}

module.exports = {
  getPublicReviews,
  upsertOrderReview,
};
