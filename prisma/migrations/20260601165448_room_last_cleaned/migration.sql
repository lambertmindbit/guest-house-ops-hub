-- AlterTable
-- (Removed Prisma's spurious DROP DEFAULT on the generated period/stay columns.)
ALTER TABLE "rooms" ADD COLUMN     "last_cleaned_at" TIMESTAMP(3);
