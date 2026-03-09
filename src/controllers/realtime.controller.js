const { registerRealtimeClient } = require("../lib/realtime");

function stream(req, res) {
  registerRealtimeClient(req, res);
}

module.exports = {
  stream,
};
