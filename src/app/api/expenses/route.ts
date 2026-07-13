import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

const EXPENSE_CATEGORIES = [
  "utilities",
  "salaries",
  "supplies",
  "maintenance",
  "marketing",
  "other",
] as const;

const paymentMode = z.enum(["cash", "upi", "card", "bank", "ota_collect"]);

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const where =
    from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? { date: { gte: parseDateOnly(from), lt: parseDateOnly(to) } }
      : {};

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });
  return ok(expenses);
}

const createSchema = z.object({
  date: dateOnly,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive(),
  note: z.string().optional(),
  paymentMode: paymentMode.optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { date, category, amount, note, paymentMode: mode } = parsed.data;

  const expense = await prisma.expense.create({
    data: { date: parseDateOnly(date), category, amount, note, paymentMode: mode },
  });
  return ok(expense, 201);
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
