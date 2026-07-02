import { listVendors, listPurchaseOrders, listVendorPayments, procurementSummary } from "@/lib/vendors";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { VendorsBoard } from "@/components/VendorsBoard";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const [vendors, pos, payments] = await Promise.all([listVendors(), listPurchaseOrders(), listVendorPayments()]);
  const summary = procurementSummary(
    pos.map((p) => ({ amount: Number(p.amount), status: p.status })),
    payments.map((p) => ({ amount: Number(p.amount) })),
  );

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Vendors" sub="Directory, purchase orders and payments." />
        <VendorsBoard
          vendors={vendors.map((v) => ({ id: v.id, name: v.name, category: v.category, contact: v.contact, rating: v.rating }))}
          pos={pos.map((p) => ({ id: p.id, vendorName: p.vendor.name, description: p.description, amount: Number(p.amount), status: p.status }))}
          payments={payments.map((p) => ({ id: p.id, vendorName: p.vendor.name, amount: Number(p.amount), paidAt: formatDateOnly(p.paidAt) }))}
          summary={summary}
        />
      </div>
    </main>
  );
}
