import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { importCsv } from "@/lib/import";

// Round-trip of the FAQ export: a client fills in the sheet, the owner uploads it.
// A row keeps its ID -> UPDATE that answer; a blank ID -> ADD a new question.
// Nothing is ever deleted, and a garbled Status must never silently go live.

const TAG = `faqimp-${Date.now()}`;
let existingId = "";
const madeIds: string[] = [];

beforeAll(async () => {
  const f = await prisma.faqEntry.create({
    data: { question: `${TAG} original question`, answer: "old answer", category: "Facilities", active: false },
  });
  existingId = f.id;
  madeIds.push(f.id);
});

afterAll(async () => {
  await prisma.faqEntry.deleteMany({ where: { id: { in: madeIds } } });
  await prisma.faqEntry.deleteMany({ where: { question: { startsWith: TAG } } });
  await prisma.$disconnect();
});

const header = "ID,Question,Answer,Category,Status";

describe("importCsv('faqs')", () => {
  it("dry-run reports changes without writing anything", async () => {
    const csv = `${header}\n${existingId},${TAG} original question,NEW answer,Facilities,Live\n,${TAG} brand new,fresh answer,Food,Hidden`;
    const res = await importCsv("faqs", csv, { dryRun: true });

    expect(res.updated).toBe(1);
    expect(res.created).toBe(1);
    expect(res.errors).toBe(0);

    const untouched = await prisma.faqEntry.findUnique({ where: { id: existingId } });
    expect(untouched!.answer).toBe("old answer"); // dry run wrote nothing
  });

  it("updates by ID and creates when the ID is blank", async () => {
    const csv = `${header}\n${existingId},${TAG} original question,NEW answer,Facilities,Live\n,${TAG} brand new,fresh answer,Food,Hidden`;
    const res = await importCsv("faqs", csv, { dryRun: false });
    expect(res.updated).toBe(1);
    expect(res.created).toBe(1);

    const updated = await prisma.faqEntry.findUnique({ where: { id: existingId } });
    expect(updated!.answer).toBe("NEW answer");
    expect(updated!.active).toBe(true); // Status "Live" switched it on

    const added = await prisma.faqEntry.findFirst({ where: { question: `${TAG} brand new` } });
    expect(added).toBeTruthy();
    expect(added!.active).toBe(false); // "Hidden" stays hidden
    madeIds.push(added!.id);
  });

  it("never silently publishes: a blank or garbled Status stays hidden", async () => {
    const csv = `${header}\n,${TAG} no status,some answer,General,\n,${TAG} junk status,some answer,General,maybe?`;
    const res = await importCsv("faqs", csv, { dryRun: false });
    expect(res.created).toBe(2);

    for (const q of [`${TAG} no status`, `${TAG} junk status`]) {
      const row = await prisma.faqEntry.findFirst({ where: { question: q } });
      expect(row!.active).toBe(false);
      madeIds.push(row!.id);
    }
  });

  it("rejects an unknown ID rather than inventing a row", async () => {
    const csv = `${header}\nnot-a-real-id,${TAG} bogus,answer,General,Live`;
    const res = await importCsv("faqs", csv, { dryRun: true });
    expect(res.errors).toBe(1);
    expect(res.created + res.updated).toBe(0);
    expect(res.results[0].message).toContain("unknown ID");
  });

  it("skips rows missing a question or answer, keeping the good ones", async () => {
    const csv = `${header}\n,,no question here,General,Live\n,${TAG} good row,good answer,General,Hidden`;
    const res = await importCsv("faqs", csv, { dryRun: false });
    expect(res.errors).toBe(1);
    expect(res.created).toBe(1);

    const good = await prisma.faqEntry.findFirst({ where: { question: `${TAG} good row` } });
    expect(good).toBeTruthy();
    madeIds.push(good!.id);
  });

  it("matches on the question when the ID is blank — never duplicates a FAQ", async () => {
    // The shareable sheet has no IDs. Re-importing it must UPDATE the existing
    // question, not add a second copy (a duplicated FAQ confuses the guest bot).
    const csv = `${header}\n,${TAG} original question,answer via question-match,Facilities,Hidden`;
    const res = await importCsv("faqs", csv, { dryRun: false });
    expect(res.updated).toBe(1);
    expect(res.created).toBe(0);

    const rows = await prisma.faqEntry.findMany({ where: { question: `${TAG} original question` } });
    expect(rows).toHaveLength(1); // still exactly one
    expect(rows[0].answer).toBe("answer via question-match");
  });

  it("doesn't duplicate when the same question appears twice in one sheet", async () => {
    const csv = `${header}\n,${TAG} dupe in sheet,first,General,Hidden\n,${TAG} dupe in sheet,second,General,Hidden`;
    const res = await importCsv("faqs", csv, { dryRun: false });
    expect(res.created).toBe(1);
    expect(res.updated).toBe(1); // the 2nd row updates the row the 1st just made

    const rows = await prisma.faqEntry.findMany({ where: { question: `${TAG} dupe in sheet` } });
    expect(rows).toHaveLength(1);
    expect(rows[0].answer).toBe("second");
    madeIds.push(rows[0].id);
  });

  it("tolerates the exported header wording (\"Answer (property to confirm / correct)\")", async () => {
    const csv = `ID,Question,Answer (property to confirm / correct),Category,Status\n,${TAG} header variant,it parsed,General,Hidden`;
    const res = await importCsv("faqs", csv, { dryRun: true });
    expect(res.created).toBe(1);
    expect(res.errors).toBe(0);
  });
});
