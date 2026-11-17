const { withRequestTiming } = require("../../lib/request-timing.cjs");

module.exports = withRequestTiming(require("../../lib/support-api.cjs"));
