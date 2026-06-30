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
