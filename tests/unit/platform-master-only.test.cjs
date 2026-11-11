// Regra do dono da plataforma: só o usuário Master define o que cada usuário
// pode fazer. Vale para a sessão do System e para o Master em suporte.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { isPlatformMaster, assertPlatformMaster } = require(path.resolve(__dirname, "..", "..", "lib", "domain-access.cjs"));

test("Master do System é reconhecido", () => {
  assert.equal(isPlatformMaster({ audience: "system", role: "MASTER" }), true);
});

test("nenhum outro perfil do System passa, mesmo com permissão de perfis", () => {
  for (const role of ["SOCIO", "ADMINISTRADOR", "DESENVOLVEDOR", "SUPORTE", "GESTOR_PERFIS"]) {
    assert.equal(isPlatformMaster({ audience: "system", role, effectivePermissions: ["system.roles.manage"] }), false, role);
    assert.throws(() => assertPlatformMaster({ audience: "system", role }), (error) => error.statusCode === 403 && error.errorCode === "platform_master_required");
  }
});

test("restaurante nunca passa, nem o Proprietário", () => {
  assert.equal(isPlatformMaster({ audience: "restaurant", role: "OWNER" }), false);
  assert.equal(isPlatformMaster({ audience: "restaurant", role: "MASTER" }), false);
});

test("em suporte, só passa se quem abriu for o Master", () => {
  assert.equal(isPlatformMaster({ audience: "support", systemRole: "MASTER" }), true);
  assert.equal(isPlatformMaster({ audience: "support", systemRole: "SUPORTE" }), false);
  assert.equal(isPlatformMaster({ audience: "support" }), false);
});
