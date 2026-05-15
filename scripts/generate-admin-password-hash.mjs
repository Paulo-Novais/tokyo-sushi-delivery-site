import { createPasswordHash } from "../lib/admin-auth.cjs";

const password = String(process.argv[2] || "").trim();

if (!password) {
  console.error("Uso: npm run admin:hash -- \"SUA_SENHA_AQUI\"");
  process.exit(1);
}

console.log(createPasswordHash(password));
