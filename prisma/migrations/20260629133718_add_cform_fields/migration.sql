-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "arrival_in_india" DATE,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passport_expiry" DATE,
ADD COLUMN     "passport_issue_date" DATE,
ADD COLUMN     "passport_issue_place" TEXT,
ADD COLUMN     "passport_number" TEXT,
ADD COLUMN     "port_of_entry" TEXT,
ADD COLUMN     "purpose_of_visit" TEXT,
ADD COLUMN     "visa_expiry" DATE,
ADD COLUMN     "visa_issue_date" DATE,
ADD COLUMN     "visa_issue_place" TEXT,
ADD COLUMN     "visa_number" TEXT,
ADD COLUMN     "visa_type" TEXT;

