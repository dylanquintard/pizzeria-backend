const prisma = require("../lib/prisma");

const RESERVED_BLOG_SLUGS = new Set([
  "",
  "admin",
  "api",
  "a-propos",
  "blog",
  "contact",
  "food-truck-pizza-moselle",
  "forgot-password",
  "gallery",
  "healthz",
  "login",
  "menu",
  "order",
  "planing",
  "pizza",
  "pizza-napolitaine-metz",
  "pizza-napolitaine-thionville",
  "profile",
  "register",
  "reset-password",
  "sitemap.xml",
  "tournee",
  "tournee-camion",
  "uploads",
  "userorders",
  "verify-email",
]);

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function parseOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Invalid string field");
  }
  const normalized = value.trim();
  return normalized || null;
}

function parseOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName} must be a boolean`);
}

function parseImageUrl(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function validateBlogSlug(slug) {
  if (!slug) {
    throw new Error("slug is required");
  }
  if (slug.startsWith("pizza-")) {
    throw new Error("slug is reserved");
  }
  if (RESERVED_BLOG_SLUGS.has(slug)) {
    throw new Error("slug is reserved");
  }
  return slug;
}

function normalizeBlogSlug(rawSlug, fallbackTitle) {
  const candidate =
    typeof rawSlug === "string" && rawSlug.trim() ? rawSlug : fallbackTitle;
  const normalized = slugify(candidate);
  return validateBlogSlug(normalized);
}

function normalizeParagraphs(source) {
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("at least one paragraph is required");
  }

  return source.map((entry, index) => ({
    sortOrder: index,
    title: parseRequiredString(entry?.title, `paragraphs[${index}].title`),
    content: parseRequiredString(entry?.content, `paragraphs[${index}].content`),
  }));
}

function normalizeImages(source) {
  if (!Array.isArray(source)) return [];

  return source
    .filter((entry) => entry && entry.imageUrl)
    .map((entry, index) => ({
      sortOrder: index,
      imageUrl: parseImageUrl(entry?.imageUrl, `images[${index}].imageUrl`),
      thumbnailUrl:
        parseOptionalString(entry?.thumbnailUrl) ||
        parseImageUrl(entry?.imageUrl, `images[${index}].imageUrl`),
      altText: parseOptionalString(entry?.altText),
      caption: parseOptionalString(entry?.caption),
    }));
}

function formatBlogParagraph(paragraph) {
  return {
    id: paragraph.id,
    title: paragraph.title,
    content: paragraph.content,
    sortOrder: paragraph.sortOrder,
    createdAt: paragraph.createdAt,
    updatedAt: paragraph.updatedAt,
  };
}

function formatBlogImage(image) {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    thumbnailUrl: image.thumbnailUrl,
    altText: image.altText,
    caption: image.caption,
    sortOrder: image.sortOrder,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
}

function getSortedCollection(source, formatter) {
  return Array.isArray(source)
    ? [...source]
        .sort((left, right) => {
          const orderDiff = Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);
          if (orderDiff !== 0) return orderDiff;
          return Number(left?.id || 0) - Number(right?.id || 0);
        })
        .map(formatter)
    : [];
}

function getArticleMetaTitle(article) {
  return String(article?.metaTitle || article?.title || "").trim() || null;
}

function getArticleMetaDescription(article) {
  return (
    String(article?.metaDescription || article?.description || "").trim() || null
  );
}

function formatBlogArticle(article) {
  const paragraphs = getSortedCollection(article?.paragraphs, formatBlogParagraph);
  const images = getSortedCollection(article?.images, formatBlogImage);
  const featuredImage = images[0] || null;

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    description: article.description,
    metaTitle: getArticleMetaTitle(article),
    metaDescription: getArticleMetaDescription(article),
    published: Boolean(article.published),
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    paragraphCount: paragraphs.length,
    imageCount: images.length,
    featuredImage,
    paragraphs,
    images,
  };
}

function formatBlogSummary(article) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    description: article.description,
    metaTitle: getArticleMetaTitle(article),
    metaDescription: getArticleMetaDescription(article),
    published: Boolean(article.published),
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    paragraphCount: Number(article?._count?.paragraphs || 0),
    imageCount: Number(article?._count?.images || 0),
    featuredImage: article?.images?.[0] ? formatBlogImage(article.images[0]) : null,
  };
}

function normalizePrismaError(error) {
  if (error?.code === "P2002") {
    throw new Error("slug already exists");
  }
  throw error;
}

async function getPublishedBlogArticles() {
  const articles = await prisma.blogArticle.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
      },
      _count: {
        select: {
          paragraphs: true,
          images: true,
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
  });

  return articles.map(formatBlogSummary);
}

async function getPublishedBlogArticleBySlug(slug) {
  const normalizedSlug = slugify(slug);
  if (!normalizedSlug) {
    throw new Error("Article not found");
  }

  const article = await prisma.blogArticle.findFirst({
    where: {
      slug: normalizedSlug,
      published: true,
    },
    include: {
      paragraphs: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!article) {
    throw new Error("Article not found");
  }

  return formatBlogArticle(article);
}

async function getAdminBlogArticles() {
  const articles = await prisma.blogArticle.findMany({
    include: {
      paragraphs: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

  return articles.map(formatBlogArticle);
}

async function createBlogArticle(payload) {
  const title = parseRequiredString(payload?.title, "title");
  const description = parseRequiredString(payload?.description, "description");
  const metaTitle = parseOptionalString(payload?.metaTitle);
  const metaDescription = parseOptionalString(payload?.metaDescription);
  const slug = normalizeBlogSlug(payload?.slug, title);
  const paragraphs = normalizeParagraphs(payload?.paragraphs);
  const images = normalizeImages(payload?.images);
  const published = parseOptionalBoolean(payload?.published, "published") ?? true;
  const publishedAt = published ? new Date() : null;

  try {
    const article = await prisma.blogArticle.create({
      data: {
        title,
        slug,
        description,
        metaTitle,
        metaDescription,
        published,
        publishedAt,
        paragraphs: {
          create: paragraphs,
        },
        images: {
          create: images,
        },
      },
      include: {
        paragraphs: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
        images: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    return formatBlogArticle(article);
  } catch (error) {
    normalizePrismaError(error);
  }
}

async function updateBlogArticle(id, payload) {
  const articleId = parsePositiveInt(id, "id");
  const existing = await prisma.blogArticle.findUnique({
    where: { id: articleId },
    include: {
      paragraphs: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!existing) {
    throw new Error("Article not found");
  }

  const title =
    payload?.title === undefined
      ? existing.title
      : parseRequiredString(payload.title, "title");
  const description =
    payload?.description === undefined
      ? existing.description
      : parseRequiredString(payload.description, "description");
  const metaTitle =
    payload?.metaTitle === undefined
      ? parseOptionalString(existing.metaTitle)
      : parseOptionalString(payload.metaTitle);
  const metaDescription =
    payload?.metaDescription === undefined
      ? parseOptionalString(existing.metaDescription)
      : parseOptionalString(payload.metaDescription);
  const slug =
    payload?.slug === undefined && payload?.title === undefined
      ? existing.slug
      : normalizeBlogSlug(payload?.slug, title);
  const paragraphs =
    payload?.paragraphs === undefined
      ? normalizeParagraphs(existing.paragraphs)
      : normalizeParagraphs(payload.paragraphs);
  const images =
    payload?.images === undefined
      ? normalizeImages(existing.images)
      : normalizeImages(payload.images);
  const published =
    payload?.published === undefined
      ? existing.published
      : parseOptionalBoolean(payload.published, "published");
  const publishedAt =
    published && !existing.publishedAt ? new Date() : existing.publishedAt;

  try {
    const article = await prisma.$transaction(async (client) => {
      await client.blogArticle.update({
        where: { id: articleId },
        data: {
          title,
          slug,
          description,
          metaTitle,
          metaDescription,
          published,
          publishedAt,
        },
      });

      await client.blogParagraph.deleteMany({
        where: { articleId },
      });

      await client.blogImage.deleteMany({
        where: { articleId },
      });

      await client.blogParagraph.createMany({
        data: paragraphs.map((paragraph) => ({
          articleId,
          sortOrder: paragraph.sortOrder,
          title: paragraph.title,
          content: paragraph.content,
        })),
      });

      if (images.length > 0) {
        await client.blogImage.createMany({
          data: images.map((image) => ({
            articleId,
            sortOrder: image.sortOrder,
            imageUrl: image.imageUrl,
            thumbnailUrl: image.thumbnailUrl,
            altText: image.altText,
            caption: image.caption,
          })),
        });
      }

      return client.blogArticle.findUnique({
        where: { id: articleId },
        include: {
          paragraphs: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
          images: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
        },
      });
    });

    return formatBlogArticle(article);
  } catch (error) {
    normalizePrismaError(error);
  }
}

async function deleteBlogArticle(id) {
  const articleId = parsePositiveInt(id, "id");

  try {
    await prisma.blogArticle.delete({
      where: { id: articleId },
    });
  } catch (error) {
    if (error?.code === "P2025") {
      throw new Error("Article not found");
    }
    throw error;
  }

  return { message: "Article deleted" };
}

async function getPublishedBlogSlugs() {
  const articles = await prisma.blogArticle.findMany({
    where: { published: true },
    select: { slug: true },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
  });

  return articles.map((article) => article.slug);
}

async function getSeoBlogArticles() {
  const articles = await prisma.blogArticle.findMany({
    where: { published: true },
    select: {
      slug: true,
      title: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      updatedAt: true,
      publishedAt: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
  });

  return articles.map((article) => ({
    slug: article.slug,
    path: `/${article.slug}`,
    title: getArticleMetaTitle(article) || article.title,
    description: getArticleMetaDescription(article) || article.description,
    image: article?.images?.[0]
      ? {
          imageUrl: article.images[0].imageUrl,
          thumbnailUrl: article.images[0].thumbnailUrl,
          altText: article.images[0].altText,
        }
      : null,
    lastmod: article.updatedAt,
    publishedAt: article.publishedAt,
  }));
}

module.exports = {
  createBlogArticle,
  deleteBlogArticle,
  getAdminBlogArticles,
  getPublishedBlogArticleBySlug,
  getPublishedBlogArticles,
  getPublishedBlogSlugs,
  getSeoBlogArticles,
  updateBlogArticle,
};
