const messageService = require("../services/message.service");

function emitMessageNotification(io, { sender, threadId, threadUserId }) {
  if (!io || !threadId) return;

  const payload = {
    threadId,
    sender,
    at: new Date().toISOString(),
  };

  if (sender === "CLIENT") {
    io.to("admins").emit("message:new", payload);
    return;
  }

  if (sender === "ADMIN" && threadUserId) {
    io.to(`user:${threadUserId}`).emit("message:new", payload);
  }
}

async function createThread(req, res) {
  try {
    const result = await messageService.createThread(req.user, req.body);
    emitMessageNotification(req.app.get("io"), {
      sender: result.sender,
      threadId: result.threadId,
      threadUserId: result.threadUserId,
    });
    res.status(201).json(result.thread);
  } catch (err) {
    const status = err.message === "Unauthorized" ? 401 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function addMessageToThread(req, res) {
  try {
    const result = await messageService.addMessageToThread(
      req.user,
      req.params.threadId,
      req.body
    );

    emitMessageNotification(req.app.get("io"), {
      sender: result.sender,
      threadId: result.threadId,
      threadUserId: result.threadUserId,
    });

    res.status(201).json(result.message);
  } catch (err) {
    const statusMap = {
      Unauthorized: 401,
      Forbidden: 403,
      "Thread not found": 404,
    };
    res.status(statusMap[err.message] || 400).json({ error: err.message });
  }
}

async function getMyThreads(req, res) {
  try {
    const threads = await messageService.getMyThreads(req.user.userId);
    res.json(threads);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAdminThreads(req, res) {
  try {
    const threads = await messageService.getAdminThreads(req.query);
    res.json(threads);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getThreadMessages(req, res) {
  try {
    const thread = await messageService.getThreadMessages(req.user, req.params.threadId);
    res.json(thread);
  } catch (err) {
    const statusMap = {
      Forbidden: 403,
      "Thread not found": 404,
    };
    res.status(statusMap[err.message] || 400).json({ error: err.message });
  }
}

async function updateThreadStatus(req, res) {
  try {
    const thread = await messageService.updateThreadStatus(
      req.params.threadId,
      req.body.status
    );
    res.json(thread);
  } catch (err) {
    const statusMap = {
      "Thread not found": 404,
    };
    res.status(statusMap[err.message] || 400).json({ error: err.message });
  }
}

async function deleteAdminThread(req, res) {
  try {
    const result = await messageService.deleteThreadAdmin(req.params.threadId);
    res.json(result);
  } catch (err) {
    const statusMap = {
      "Thread not found": 404,
    };
    res.status(statusMap[err.message] || 400).json({ error: err.message });
  }
}

module.exports = {
  createThread,
  addMessageToThread,
  getMyThreads,
  getAdminThreads,
  getThreadMessages,
  updateThreadStatus,
  deleteAdminThread,
};
