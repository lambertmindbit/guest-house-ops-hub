-- Optional media on a FAQ entry (photo URLs + a map link) the assistant can show
-- with the answer. Purely additive: one nullable jsonb column.
ALTER TABLE "faq_entries" ADD COLUMN "media" JSONB;
