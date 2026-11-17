const { withRequestTiming } = require("../../../lib/request-timing.cjs");
const { SESSION_AUDIENCES } = require("../../../lib/domain-sessions.cjs");
const {
  createDomainAuthHandler,
} = require("../../../lib/domain-auth-api.cjs");

module.exports = withRequestTiming(createDomainAuthHandler(SESSION_AUDIENCES.SYSTEM));
