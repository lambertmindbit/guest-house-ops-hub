import { prisma } from "@/lib/prisma";

// Keep the scam-number list in sync with the guest blacklist. Blacklisting a
// guest adds their phone to the FlaggedNumber list (so it shows in Settings →
// Scam numbers AND blocks Save at booking time); un-blacklisting removes it.
// Called after a guest create/update whenever `blocked`/`blockReason` was set.
export async function syncBlacklistToScamList(guest: {
  phone: string;
  blocked: boolean;
  blockReason: string | null;
}) {
  // An erased guest's phone is a tombstone, not a real number (GAP-8). Their block
  // already survives as a one-way hash, so never write the tombstone to the list —
  // and never delete, which would silently drop that preserved block.
  if (guest.phone.startsWith("erased-")) return;

  if (guest.blocked) {
    const reason = guest.blockReason ?? "Blacklisted guest";
    await prisma.flaggedNumber.upsert({
      where: { phone: guest.phone },
      update: { reason },
      create: { phone: guest.phone, reason },
    });
  } else {
    await prisma.flaggedNumber.deleteMany({ where: { phone: guest.phone } });
  }
}
