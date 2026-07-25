const { SESSION_AUDIENCES } = require("../../../lib/domain-sessions.cjs");
const {
  createDomainAuthHandler,
} = require("../../../lib/domain-auth-api.cjs");

module.exports = createDomainAuthHandler(SESSION_AUDIENCES.SYSTEM);
