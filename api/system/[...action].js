const { withRequestTiming } = require("../../lib/request-timing.cjs");

module.exports = withRequestTiming(require("../../lib/system-api.cjs"));
