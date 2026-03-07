const messageService = require("../services/message.service");

async function createThread(req, res) {
  try {
    const thread = await messageService.createThread(req.user, req.body);
    res.status(201).json(thread);
  } catch (err) {
    const status = err.message === "Unauthorized" ? 401 : 400;
    res.status(status).json({ error: err.message });
  }
}

async function addMessageToThread(req, res) {
  try {
    const message = await messageService.addMessageToThread(
      req.user,
      req.params.threadId,
      req.body
    );
    res.status(201).json(message);
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
