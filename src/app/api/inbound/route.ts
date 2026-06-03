import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, zodFail } from "@/lib/api";
import { ingestEmail } from "@/lib/inbound";

// Owner-authenticated paste: the Inbox screen submits a raw confirmation email
// here. (The future inbox webhook hits /api/ingest/email with a token instead.)
const schema = z.object({ raw: z.string().min(1, "paste the email text") });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const inbound = await ingestEmail(parsed.data.raw);
  return ok(inbound, 201);
}

export async function GET() {
  const items = await prisma.inboundBooking.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}
