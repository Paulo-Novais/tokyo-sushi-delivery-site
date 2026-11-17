const test = require("node:test");
const assert = require("node:assert/strict");
const { recordDatabaseTime, withRequestTiming } = require("../../lib/request-timing.cjs");

const fakeResponse = () => {
  const headers = new Map();
  return {
    headersSent: false,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    writeHead() {
      this.headersSent = true;
      return this;
    },
    end() {
      this.writeHead(200);
    },
    headers,
  };
};

test("Server-Timing traz tempo total e do banco com o número de consultas", async () => {
  const handler = withRequestTiming(async (req, res) => {
    recordDatabaseTime(12);
    await new Promise((resolve) => setTimeout(resolve, 5));
    recordDatabaseTime(8);
    res.end();
  });
  const res = fakeResponse();
  await handler({}, res);
  const header = res.getHeader("Server-Timing");
  assert.match(header, /db;dur=20\.0;desc="banco \(2 consultas\)"/);
  assert.match(header, /app;dur=\d+\.\d/);
  assert.match(header, /total;dur=\d+\.\d/);
});

test("pedidos ao mesmo tempo não misturam a contagem do banco", async () => {
  const handler = withRequestTiming(async (req, res) => {
    for (let index = 0; index < req.queries; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      recordDatabaseTime(1);
    }
    res.end();
  });
  const first = fakeResponse();
  const second = fakeResponse();
  await Promise.all([handler({ queries: 3 }, first), handler({ queries: 7 }, second)]);
  assert.match(first.getHeader("Server-Timing"), /\(3 consultas\)/);
  assert.match(second.getHeader("Server-Timing"), /\(7 consultas\)/);
});

test("handler aninhado (reviews -> catálogo) mede uma vez só e fora de pedido não quebra", async () => {
  const inner = withRequestTiming(async (req, res) => {
    recordDatabaseTime(5);
    res.end();
  });
  const outer = withRequestTiming((req, res) => inner(req, res));
  const res = fakeResponse();
  await outer({}, res);
  assert.match(res.getHeader("Server-Timing"), /\(1 consulta\)/);
  assert.doesNotThrow(() => recordDatabaseTime(3));
});
