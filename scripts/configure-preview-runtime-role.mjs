console.error(
  [
    "Blocked legacy command: it transferred ownership and granted broad privileges.",
    "Use scripts/configure-runtime-database-role.mjs with MIGRATION_DATABASE_URL",
    "and the audited least-privilege allowlist instead.",
  ].join(" ")
);
process.exit(1);
