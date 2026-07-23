import { prisma } from "@/lib/prisma";
import { currentPropertySettings } from "@/lib/property-settings";

// Client data export / offboarding (GAP-23). A departing client can take EVERYTHING
// this deployment holds for their property, in one machine-readable file. The
// tenant-scoped `prisma` client auto-filters every query to the acting property, so
// this can only ever export that one property's data — never a peer's.
//
// This is the operational + financial + configuration record: enough to reconstruct
// the business elsewhere or hand to an accountant. It complements the per-guest DPDP
// export (src/lib/dpdp.ts); this one is property-wide and owner-triggered.
export async function exportPropertyData() {
  const property = await currentPropertySettings();

  const [
    roomTypes, rooms, channels, agents, reservations, blocks,
    expenses, payouts, cancellationPolicy, pricingPolicy, seasons, rateOverrides,
    staff, shifts, attendance, vendors, purchaseOrders, vendorPayments,
    drivers, trips, tourPartners, tours, tourBookings,
    complaints, reviewRequests, outboundMessages,
    assets, maintenanceRequests, inventoryItems, stockMovements,
    housekeepingTasks, bookingGroups, icalFeeds, faqEntries, invoices,
  ] = await Promise.all([
    prisma.roomType.findMany(),
    prisma.room.findMany(),
    prisma.channel.findMany(),
    prisma.agent.findMany(),
    // The heart of it: bookings with their money trail AND the guest on each — Guest
    // is shared owner-wide (NOT tenant-scoped), so a blind guest.findMany() would leak
    // every property's guests. Scoping to "guests who booked HERE" is the correct set.
    prisma.reservation.findMany({ include: { payments: true, refunds: true, guest: true } }),
    prisma.block.findMany(),
    prisma.expense.findMany(),
    prisma.payout.findMany(),
    prisma.cancellationPolicy.findMany(),
    prisma.pricingPolicy.findMany(),
    prisma.season.findMany(),
    prisma.rateOverride.findMany(),
    prisma.staff.findMany(),
    prisma.shift.findMany(),
    prisma.attendance.findMany(),
    prisma.vendor.findMany(),
    prisma.purchaseOrder.findMany(),
    prisma.vendorPayment.findMany(),
    prisma.driver.findMany(),
    prisma.trip.findMany(),
    prisma.tourPartner.findMany(),
    prisma.tour.findMany(),
    prisma.tourBooking.findMany(),
    prisma.complaint.findMany(),
    prisma.reviewRequest.findMany(),
    prisma.outboundMessage.findMany(),
    prisma.asset.findMany(),
    prisma.maintenanceRequest.findMany(),
    prisma.inventoryItem.findMany(),
    prisma.stockMovement.findMany(),
    prisma.housekeepingTask.findMany(),
    prisma.bookingGroup.findMany(),
    prisma.icalFeed.findMany(),
    prisma.faqEntry.findMany(),
    prisma.invoice.findMany({ include: { lines: true } }),
  ]);

  // Unique guests who booked at this property, derived from the (tenant-scoped)
  // reservations — never a cross-property guest.
  const guests = [...new Map(reservations.map((r) => [r.guest.id, r.guest])).values()];

  return {
    exportedAt: new Date().toISOString(),
    property,
    // Money is integer paise throughout (GAP-9); tax invoices are immutable snapshots.
    note: "All money values are integer paise (÷100 for rupees). Invoices are point-in-time snapshots and never change.",
    setup: { roomTypes, rooms, channels, agents, cancellationPolicy, pricingPolicy, seasons, rateOverrides, icalFeeds, faqEntries },
    guests,
    bookings: reservations,
    blocks,
    bookingGroups,
    finance: { expenses, payouts, invoices },
    staff: { staff, shifts, attendance },
    vendors: { vendors, purchaseOrders, vendorPayments },
    transport: { drivers, trips },
    tours: { tourPartners, tours, tourBookings },
    inventory: { assets, maintenanceRequests, inventoryItems, stockMovements },
    housekeeping: housekeepingTasks,
    guestRelations: { complaints, reviewRequests, outboundMessages },
  };
}
