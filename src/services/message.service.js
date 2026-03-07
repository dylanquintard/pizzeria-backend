const { MessageSender, MessageThreadStatus, Role } = require("@prisma/client");
const prisma = require("../lib/prisma");

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseThreadStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!MessageThreadStatus[normalized]) {
    throw new Error("Invalid thread status");
  }
  return MessageThreadStatus[normalized];
}

function parseMessageContent(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("content is required");
  }
  return value.trim();
}

function parseOptionalSubject(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("subject must be a string");
  const subject = value.trim();
  return subject || null;
}

async function getThreadOrThrow(threadId) {
  const parsedThreadId = parsePositiveInt(threadId, "threadId");
  const thread = await prisma.messageThread.findUnique({
    where: { id: parsedThreadId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
  if (!thread) throw new Error("Thread not found");
  return thread;
}

function isAdmin(user) {
  return user?.role === Role.ADMIN || user?.role === "ADMIN";
}

function assertCanAccessThread(user, thread) {
  if (isAdmin(user)) return;
  if (!thread.userId || thread.userId !== user.userId) {
    throw new Error("Forbidden");
  }
}

function getSenderFromUser(user) {
  return isAdmin(user) ? MessageSender.ADMIN : MessageSender.CLIENT;
}

async function withUnreadCounts(threads, unreadSender) {
  if (!Array.isArray(threads) || threads.length === 0) return [];

  const threadIds = threads.map((thread) => thread.id);
  const unreadRows = await prisma.message.groupBy({
    by: ["threadId"],
    where: {
      threadId: { in: threadIds },
      sender: unreadSender,
      isRead: false,
    },
    _count: { _all: true },
  });

  const unreadMap = new Map(unreadRows.map((entry) => [entry.threadId, entry._count._all]));

  return threads.map((thread) => ({
    ...thread,
    unreadCount: unreadMap.get(thread.id) || 0,
  }));
}

async function createThread(user, payload) {
  if (!user?.userId) throw new Error("Unauthorized");

  const subject = parseOptionalSubject(payload.subject);
  const content = parseMessageContent(payload.content);
  const sender = getSenderFromUser(user);
  const now = new Date();

  const thread = await prisma.$transaction(async (tx) => {
    const thread = await tx.messageThread.create({
      data: {
        userId: user.userId,
        subject,
        status: MessageThreadStatus.OPEN,
        lastMessageAt: now,
      },
    });

    await tx.message.create({
      data: {
        threadId: thread.id,
        sender,
        senderUserId: user.userId,
        content,
      },
    });

    return tx.messageThread.findUnique({
      where: { id: thread.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  });

  return {
    thread,
    sender,
    threadUserId: thread?.userId || user.userId,
    threadId: thread?.id || null,
  };
}

async function addMessageToThread(user, threadId, payload) {
  if (!user?.userId) throw new Error("Unauthorized");

  const thread = await getThreadOrThrow(threadId);
  assertCanAccessThread(user, thread);

  const content = parseMessageContent(payload.content);
  const sender = getSenderFromUser(user);
  const now = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        threadId: thread.id,
        sender,
        senderUserId: user.userId,
        content,
        isRead: false,
      },
    });

    await tx.messageThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: now,
        status: MessageThreadStatus.OPEN,
      },
    });

    return message;
  });

  return {
    message,
    sender,
    threadUserId: thread.userId || null,
    threadId: thread.id,
  };
}

async function getMyThreads(userId) {
  const parsedUserId = parsePositiveInt(userId, "userId");

  const threads = await prisma.messageThread.findMany({
    where: { userId: parsedUserId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return withUnreadCounts(threads, MessageSender.ADMIN);
}

async function getAdminThreads(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = parseThreadStatus(filters.status);
  }

  if (filters.userId) {
    where.userId = parsePositiveInt(filters.userId, "userId");
  }

  const threads = await prisma.messageThread.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return withUnreadCounts(threads, MessageSender.CLIENT);
}

async function getThreadMessages(user, threadId) {
  const thread = await getThreadOrThrow(threadId);
  assertCanAccessThread(user, thread);

  const unreadSender = isAdmin(user) ? MessageSender.CLIENT : MessageSender.ADMIN;

  await prisma.message.updateMany({
    where: {
      threadId: thread.id,
      sender: unreadSender,
      isRead: false,
    },
    data: { isRead: true },
  });

  return prisma.messageThread.findUnique({
    where: { id: thread.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function updateThreadStatus(threadId, status) {
  const parsedThreadId = parsePositiveInt(threadId, "threadId");
  const nextStatus = parseThreadStatus(status);

  return prisma.messageThread.update({
    where: { id: parsedThreadId },
    data: { status: nextStatus },
  });
}

async function deleteThreadAdmin(threadId) {
  const parsedThreadId = parsePositiveInt(threadId, "threadId");
  await getThreadOrThrow(parsedThreadId);

  await prisma.messageThread.delete({ where: { id: parsedThreadId } });
  return { id: parsedThreadId, deleted: true };
}

module.exports = {
  createThread,
  addMessageToThread,
  getMyThreads,
  getAdminThreads,
  getThreadMessages,
  updateThreadStatus,
  deleteThreadAdmin,
};

