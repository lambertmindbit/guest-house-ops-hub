import { prisma } from "@/lib/prisma";
import { createReservation, OverlapError } from "@/lib/reservations";
import { parseDateOnly } from "@/lib/dates";
import { rupeesToPaise } from "@/lib/money";

// Guided CSV import for onboarding a property off paper/WhatsApp. Two sheets:
// guests and bookings. Every booking row is created through createReservation()
// so it inherits the no_overlapping_confirmed_stays 409 — the importer can NEVER
// bypass the double-booking guarantee.

export type ImportType = "guests" | "bookings" | "faqs";
export type ImportRowResult = { row: number; status: "created" | "updated" | "error"; message: string };
export type ImportResult = { results: ImportRowResult[]; created: number; updated: number; errors: number };

// Minimal RFC-4180-ish parser: quoted fields, embedded commas/newlines, "" escapes.
export function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  // Drop fully-blank lines (e.g. a trailing newline).
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function importCsv(
  type: ImportType,
  csvText: string,
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { results: [{ row: 1, status: "error", message: "No data rows found (need a header + at least one row)." }], created: 0, updated: 0, errors: 1 };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  // Header lookup that tolerates a client renaming a column slightly — the FAQ
  // sheet ships with "Answer (property to confirm / correct)", and people add
  // notes to headers. Falls back to the first header STARTING with the name.
  const colLike = (name: string) => {
    const exact = col(name);
    if (exact >= 0) return exact;
    return header.findIndex((h) => h.startsWith(name));
  };

  // Preload the property's FAQs so a round-tripped sheet matches existing rows
  // without a query per line — by ID, and ALSO by question text. The question
  // fallback matters: a sheet that wasn't exported from the app (or lost its ID
  // column in Excel) would otherwise re-add all 40 questions as duplicates, and a
  // duplicated FAQ is exactly what confuses the guest bot.
  const faqIds = new Set<string>();
  const faqIdByQuestion = new Map<string, string>();
  if (type === "faqs") {
    for (const f of await prisma.faqEntry.findMany({ select: { id: true, question: true } })) {
      faqIds.add(f.id);
      faqIdByQuestion.set(f.question.trim().toLowerCase(), f.id);
    }
  }

  // Preload rooms/channels for booking resolution.
  const roomByLabel = new Map<string, string>();
  const channelByName = new Map<string, string>();
  if (type === "bookings") {
    const [rooms, channels] = await Promise.all([
      prisma.room.findMany({ where: { archivedAt: null }, select: { id: true, label: true } }),
      prisma.channel.findMany({ select: { id: true, name: true } }),
    ]);
    for (const r of rooms) roomByLabel.set(r.label.toLowerCase(), r.id);
    for (const c of channels) channelByName.set(c.name.toLowerCase(), c.id);
  }

  const results: ImportRowResult[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = (j: number) => (j >= 0 && j < cells.length ? cells[j].trim() : "");
    const rowNo = i + 1; // 1-based, including the header row

    try {
      if (type === "guests") {
        const name = get(col("name"));
        const phone = get(col("phone"));
        if (!name || !phone) {
          results.push({ row: rowNo, status: "error", message: "name and phone are required" });
          continue;
        }
        if (opts.dryRun) {
          results.push({ row: rowNo, status: "created", message: `${name} (${phone})` });
          continue;
        }
        const fields = {
          name,
          email: get(col("email")) || null,
          address: get(col("address", "address_line")) || null,
          vehicleNumber: get(col("vehicle", "vehicle_number", "vehiclenumber")) || null,
          idNumber: get(col("idnumber", "id", "id_number")) || null,
          notes: get(col("notes")) || null,
        };
        await prisma.guest.upsert({ where: { phone }, update: fields, create: { phone, ...fields } });
        results.push({ row: rowNo, status: "created", message: name });
      } else if (type === "faqs") {
        // Round-trip of the FAQ export: a row with an ID UPDATES that FAQ, a row
        // with a blank ID ADDS one. Nothing is ever deleted, so a bad sheet can be
        // corrected by re-importing rather than losing content.
        const rawId = get(colLike("id"));
        const question = get(colLike("question"));
        const answer = get(colLike("answer"));
        const category = get(colLike("category"));
        const statusRaw = get(colLike("status")).toLowerCase();
        // Anything that isn't clearly "live" stays hidden from guests — the safe
        // default, since a blank/garbled status must never silently go live.
        const active = /^(live|active|yes|true|on|show)/.test(statusRaw);

        if (!question || !answer) {
          results.push({ row: rowNo, status: "error", message: "Question and Answer are both required" });
          continue;
        }
        if (rawId && !faqIds.has(rawId)) {
          results.push({
            row: rowNo,
            status: "error",
            message: `unknown ID "${rawId}" — clear the ID cell to add this as a new FAQ`,
          });
          continue;
        }
        // No ID? Fall back to matching the question, so re-importing a sheet
        // updates in place instead of duplicating the whole FAQ.
        const id = rawId || faqIdByQuestion.get(question.trim().toLowerCase()) || "";

        const label = `${active ? "Live" : "Hidden"} · ${question.slice(0, 60)}`;
        if (id) {
          if (!opts.dryRun) {
            await prisma.faqEntry.update({
              where: { id },
              data: { question, answer, category: category || null, active },
            });
          }
          results.push({ row: rowNo, status: "updated", message: label });
        } else {
          if (!opts.dryRun) {
            const made = await prisma.faqEntry.create({
              data: { question, answer, category: category || null, active },
            });
            // Guard against the same question appearing twice in ONE sheet.
            faqIds.add(made.id);
            faqIdByQuestion.set(question.trim().toLowerCase(), made.id);
          }
          results.push({ row: rowNo, status: "created", message: label });
        }
      } else {
        const phone = get(col("phone", "guestphone", "guest_phone"));
        const name = get(col("name", "guestname", "guest_name")) || phone;
        const roomLabel = get(col("room", "room_label", "roomlabel"));
        const channelName = get(col("channel"));
        const checkIn = get(col("checkin", "check_in", "check-in"));
        const checkOut = get(col("checkout", "check_out", "check-out"));
        const amount = get(col("amount", "gross", "grossamount", "gross_amount"));
        const advance = get(col("advance", "advancerequired", "advance_required"));
        const statusRaw = (get(col("status")) || "confirmed").toLowerCase();

        if (!phone || !roomLabel || !channelName || !checkIn || !checkOut) {
          results.push({ row: rowNo, status: "error", message: "phone, room, channel, checkin and checkout are required" });
          continue;
        }
        if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) {
          results.push({ row: rowNo, status: "error", message: "dates must be YYYY-MM-DD" });
          continue;
        }
        if (!(checkOut > checkIn)) {
          results.push({ row: rowNo, status: "error", message: "checkout must be after checkin" });
          continue;
        }
        const roomId = roomByLabel.get(roomLabel.toLowerCase());
        if (!roomId) {
          results.push({ row: rowNo, status: "error", message: `unknown room "${roomLabel}"` });
          continue;
        }
        const channelId = channelByName.get(channelName.toLowerCase());
        if (!channelId) {
          results.push({ row: rowNo, status: "error", message: `unknown channel "${channelName}"` });
          continue;
        }
        const status = statusRaw === "cancelled" ? "cancelled" : statusRaw === "no_show" || statusRaw === "no-show" ? "no_show" : "confirmed";

        if (opts.dryRun) {
          results.push({ row: rowNo, status: "created", message: `${name} · Room ${roomLabel} · ${checkIn}→${checkOut}` });
          continue;
        }

        const guest = await prisma.guest.upsert({ where: { phone }, update: { name }, create: { name, phone } });
        try {
          // Same guarded create path as the owner/agent — inherits the 409.
          await createReservation({
            roomId,
            guestId: guest.id,
            channelId,
            checkIn: parseDateOnly(checkIn),
            checkOut: parseDateOnly(checkOut),
            // CSV amounts are rupees; storage + createReservation are paise (GAP-9).
            grossAmount: amount ? rupeesToPaise(Number(amount)) : undefined,
            advanceRequired: advance ? rupeesToPaise(Number(advance)) : undefined,
            status,
          });
          results.push({ row: rowNo, status: "created", message: `${name} · Room ${roomLabel}` });
        } catch (e) {
          if (e instanceof OverlapError) {
            results.push({ row: rowNo, status: "error", message: "dates overlap an existing booking for this room" });
          } else throw e;
        }
      }
    } catch (e) {
      results.push({ row: rowNo, status: "error", message: e instanceof Error ? e.message : "row failed" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const errors = results.filter((r) => r.status === "error").length;
  return { results, created, updated, errors };
}
