import { withRoute, fail } from "@/lib/api";
import { invoiceForReservation } from "@/lib/invoices";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

// Server-side invoice PDF (US-206). Renders the issued SNAPSHOT, so the file is
// identical every time it's downloaded — the statutory reprint guarantee.
async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await invoiceForReservation(id);
  if (!inv) return fail("No invoice has been issued for this booking yet.", 404);

  const pdf = await renderInvoicePdf({
    number: inv.number,
    issuedAt: inv.issuedAt,
    cancelledAt: inv.cancelledAt,
    propertyName: inv.propertyName,
    propertyAddress: inv.propertyAddress,
    propertyGstin: inv.propertyGstin,
    guestName: inv.guestName,
    guestPhone: inv.guestPhone,
    nights: inv.nights,
    taxRatePct: Number(inv.taxRatePct),
    taxablePaise: Number(inv.taxablePaise),
    cgstPaise: Number(inv.cgstPaise),
    sgstPaise: Number(inv.sgstPaise),
    roundOffPaise: Number(inv.roundOffPaise),
    totalPaise: Number(inv.totalPaise),
    paidPaise: Number(inv.paidPaise),
    lines: inv.lines.map((l) => ({
      description: l.description,
      qty: l.qty,
      unitPaise: Number(l.unitPaise),
      amountPaise: Number(l.amountPaise),
    })),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${inv.number.replace(/\//g, "-")}.pdf"`,
    },
  });
}

export const GET = withRoute(handleGET);
