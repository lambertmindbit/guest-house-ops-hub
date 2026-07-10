// The no-double-booking guarantee is a Postgres GiST exclusion constraint.
// A violation surfaces as SQLSTATE 23P01 (exclusion_violation). Prisma doesn't
// model this as a typed error, so we sniff the raw Postgres code/constraint
// name off the error to turn it into a friendly message at the API boundary.
const CONSTRAINT_NAME = "no_overlapping_confirmed_stays";

export function isOverlapError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const meta = "meta" in error ? JSON.stringify(error.meta) : "";
  const haystack = `${message} ${meta}`;
  return haystack.includes("23P01") || haystack.includes(CONSTRAINT_NAME);
}

// A unique-constraint violation (Prisma P2002 / Postgres 23505). Lets a caller
// treat a lost race to insert a de-duplicated row as "already done", not an error.
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && (error as { code?: string }).code === "P2002") return true;
  const message = "message" in error ? String(error.message) : "";
  return message.includes("23505");
}
