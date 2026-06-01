// Safety gate for the integration suite. These tests create and delete real
// rows, so they must not run against the production database by accident.
//
// Resolution order:
//   1. TEST_DATABASE_URL set  -> use it (point at a disposable/local Postgres).
//   2. ALLOW_PROD_DB_TESTS=1   -> explicit opt-in to use DATABASE_URL as-is.
//   3. otherwise               -> refuse to run.
//
// Runs after `dotenv/config` (see vitest.config.ts) and before any test file
// imports the Prisma client, so overriding DATABASE_URL here takes effect.
const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  process.env.DATABASE_URL = testUrl;
} else if (process.env.ALLOW_PROD_DB_TESTS !== "1") {
  throw new Error(
    "Refusing to run the integration suite against DATABASE_URL — it may be production.\n" +
      "Set TEST_DATABASE_URL to a disposable database (recommended), or set " +
      "ALLOW_PROD_DB_TESTS=1 to explicitly run against the configured DATABASE_URL.",
  );
}
