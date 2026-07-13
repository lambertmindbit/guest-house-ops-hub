import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { dateOnly } from "@/lib/dates";
import { getAvailability } from "@/lib/availability";

const schema = z
  .object({
    roomTypeId: z.string().min(1),
    from: dateOnly,
    to: dateOnly,
  })
  .refine((d) => d.to > d.from, {
    path: ["to"],
    message: "`to` must be after `from`",
  });

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    roomTypeId: searchParams.get("roomTypeId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  const { roomTypeId, from, to } = parsed.data;
  const nights = await getAvailability(roomTypeId, from, to);
  return ok(nights);
}

export const GET = withRoute(handleGET);
