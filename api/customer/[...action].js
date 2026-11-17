const { withRequestTiming } = require("../../lib/request-timing.cjs");

module.exports = withRequestTiming(require("../../lib/customer-api.cjs"));
