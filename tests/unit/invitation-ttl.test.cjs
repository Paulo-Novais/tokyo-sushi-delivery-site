// Validade do convite: quem convida escolhe 48 horas ou 7 dias.
// Qualquer outro valor cai no padrão da plataforma (nunca maior que 7 dias).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { resolveInvitationTtlHours } = require(path.resolve(__dirname, "..", "..", "lib", "user-permissions.cjs"));

test("aceita 48 horas e 7 dias", () => {
  assert.equal(resolveInvitationTtlHours(48), 48);
  assert.equal(resolveInvitationTtlHours("168"), 168);
});

test("outros valores usam o padrão da plataforma", () => {
  const previous = process.env.INOVAS_INVITE_TTL_HOURS;
  delete process.env.INOVAS_INVITE_TTL_HOURS;
  try {
    for (const value of [undefined, "", 0, -5, 24, 1000, "abc", 9999]) {
      assert.equal(resolveInvitationTtlHours(value), 48, String(value));
    }
  } finally {
    if (previous !== undefined) process.env.INOVAS_INVITE_TTL_HOURS = previous;
  }
});
