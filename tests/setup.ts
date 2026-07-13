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

// Local/ephemeral hosts we trust as disposable: a dev's `docker compose up -d db`,
// and the CI Postgres service (both resolve to localhost). Anything else is a
// REMOTE host — likely a managed/production database — and must be opted into
// explicitly. (CI intentionally sets TEST_DATABASE_URL == DATABASE_URL on
// localhost, so "same host as DATABASE_URL" can't be the test — this can.)
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "postgres"]);

function isLocalHost(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

if (testUrl) {
  // A remote TEST_DATABASE_URL (not localhost/docker) is probably production, and
  // this suite creates/deletes real rows — refuse unless explicitly overridden.
  if (!isLocalHost(testUrl) && process.env.ALLOW_PROD_DB_TESTS !== "1") {
    throw new Error(
      "Refusing to run the integration suite: TEST_DATABASE_URL points at a REMOTE host,\n" +
        "which is probably production, and these tests create/delete real rows. Point it at a\n" +
        "disposable database (`docker compose up -d db` gives you one on localhost), or set\n" +
        "ALLOW_PROD_DB_TESTS=1 to override.",
    );
  }
  process.env.DATABASE_URL = testUrl;
} else if (process.env.ALLOW_PROD_DB_TESTS !== "1") {
  throw new Error(
    "Refusing to run the integration suite against DATABASE_URL — it may be production.\n" +
      "Set TEST_DATABASE_URL to a disposable database (recommended), or set " +
      "ALLOW_PROD_DB_TESTS=1 to explicitly run against the configured DATABASE_URL.",
  );
}
