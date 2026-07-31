const { buildHttpError } = require("./http.cjs");

const MIGRATION_MANAGED_MODES = new Set(["migration", "migrations", "managed"]);

const isMigrationManagedDatabase = () =>
  process.env.NODE_ENV === "production" ||
  MIGRATION_MANAGED_MODES.has(
    String(process.env.INOVAS_DATABASE_SCHEMA_MODE || "")
      .trim()
      .toLowerCase()
  );

const assertMigrationManagedRelations = async ({
  sql,
  relations,
  component,
}) => {
  if (!isMigrationManagedDatabase()) {
    return false;
  }

  const missing = [];
  for (const relation of relations) {
    const qualifiedName = `public.${relation}`;
    const rows = await sql`
      SELECT to_regclass(${qualifiedName}) IS NOT NULL AS available
    `;
    if (rows[0]?.available !== true) {
      missing.push(relation);
    }
  }

  if (missing.length) {
    throw buildHttpError(
      503,
      `Estrutura de banco indisponivel para ${component}.`,
      "database_migration_required",
      { missingRelations: missing }
    );
  }

  return true;
};

module.exports = {
  assertMigrationManagedRelations,
  isMigrationManagedDatabase,
};
