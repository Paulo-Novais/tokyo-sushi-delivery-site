import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  assertMigrationManagedRelations,
  isMigrationManagedDatabase,
} = require("../lib/database-schema.cjs");

const originalNodeEnvironment = process.env.NODE_ENV;
const originalSchemaMode = process.env.INOVAS_DATABASE_SCHEMA_MODE;

try {
  process.env.NODE_ENV = "production";
  delete process.env.INOVAS_DATABASE_SCHEMA_MODE;
  assert.equal(isMigrationManagedDatabase(), true);

  const queriedRelations = [];
  const sql = (strings, value) => {
    queriedRelations.push(value);
    return Promise.resolve([{ available: value !== "public.missing_table" }]);
  };
  const managed = await assertMigrationManagedRelations({
    sql,
    relations: ["orders", "order_items"],
    component: "test",
  });
  assert.equal(managed, true);
  assert.deepEqual(queriedRelations, ["public.orders", "public.order_items"]);

  await assert.rejects(
    assertMigrationManagedRelations({
      sql,
      relations: ["missing_table"],
      component: "test",
    }),
    (error) =>
      error?.statusCode === 503 &&
      error?.errorCode === "database_migration_required" &&
      error?.missingRelations?.[0] === "missing_table"
  );

  process.env.NODE_ENV = "development";
  delete process.env.INOVAS_DATABASE_SCHEMA_MODE;
  assert.equal(isMigrationManagedDatabase(), false);
  assert.equal(
    await assertMigrationManagedRelations({
      sql,
      relations: ["missing_table"],
      component: "test",
    }),
    false
  );

  console.log("RUNTIME_SCHEMA_BOUNDARY_LOCAL_VALID;checks=7");
} finally {
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnvironment;
  if (originalSchemaMode === undefined) {
    delete process.env.INOVAS_DATABASE_SCHEMA_MODE;
  } else {
    process.env.INOVAS_DATABASE_SCHEMA_MODE = originalSchemaMode;
  }
}

