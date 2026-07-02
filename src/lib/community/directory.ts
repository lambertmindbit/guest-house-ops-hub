import { prisma, unscopedPrisma } from "@/lib/prisma";

// Searchable peer directory (Phase 3, slice b). Read-only discovery over
// properties that opted IN with isDiscoverable (slice a). A property's public
// profile + amenities are visible to any peer; its contact phone is revealed
// only once the two are connected (an accepted NetworkConnection). Amenities are
// per-property and tenant-scoped, so peer amenities are read via the unscoped
// client — this module is one of the sanctioned cross-tenant readers.

export const DIRECTORY_NEEDS = [
  "Parking", "Airport pickup", "Pets", "Wheelchair", "Family rooms", "Wi-Fi", "Meals",
];
export const PRICE_BANDS = ["budget", "premium"];

export type DirectoryEntry = {
  propertyId: string;
  name: string;
  locality: string | null;
  bio: string | null;
  priceBand: string | null;
  amenities: string[];
  photoPaths: string[];
  connected: boolean;
  contactPhone: string | null; // null unless connected
};

export type DirectoryFilters = { needs?: string[]; priceBand?: string | null };

// Pure: does an entry satisfy the filters? A need matches by normalized substring
// against the entry's amenity names (AND across needs); priceBand is exact.
export function matchesFilters(entry: DirectoryEntry, filters: DirectoryFilters): boolean {
  if (filters.priceBand && entry.priceBand !== filters.priceBand) return false;
  const haystack = entry.amenities.map((a) => a.toLowerCase());
  for (const need of filters.needs ?? []) {
    const n = need.toLowerCase().trim();
    if (n && !haystack.some((a) => a.includes(n))) return false;
  }
  return true;
}

export async function searchDirectory(
  viewerPropertyId: string,
  filters: DirectoryFilters = {},
): Promise<DirectoryEntry[]> {
  // Discoverable peers. PropertySettings is the tenant root (not auto-scoped),
  // so this returns every opted-in property, not just the viewer's.
  const peers = await prisma.propertySettings.findMany({
    where: { isDiscoverable: true, id: { not: viewerPropertyId } },
    select: {
      id: true, name: true, publicName: true, locality: true, bio: true,
      priceBand: true, contactPhone: true, photoPaths: true,
    },
    orderBy: { name: "asc" },
  });
  const peerIds = peers.map((p) => p.id);
  if (peerIds.length === 0) return [];

  // Peer amenities — cross-tenant, so via the unscoped client.
  const amenities = await unscopedPrisma.amenity.findMany({
    where: { propertyId: { in: peerIds } },
    select: { propertyId: true, name: true },
  });
  const amenityByProp = new Map<string, string[]>();
  for (const a of amenities) {
    if (!a.propertyId) continue;
    const arr = amenityByProp.get(a.propertyId) ?? [];
    arr.push(a.name);
    amenityByProp.set(a.propertyId, arr);
  }

  // Accepted connections decide whose contact phone the viewer may see.
  const connections = await prisma.networkConnection.findMany({
    where: {
      status: "accepted",
      OR: [
        { requesterPropertyId: viewerPropertyId, addresseePropertyId: { in: peerIds } },
        { addresseePropertyId: viewerPropertyId, requesterPropertyId: { in: peerIds } },
      ],
    },
    select: { requesterPropertyId: true, addresseePropertyId: true },
  });
  const connectedIds = new Set<string>();
  for (const c of connections) {
    connectedIds.add(c.requesterPropertyId === viewerPropertyId ? c.addresseePropertyId : c.requesterPropertyId);
  }

  const entries: DirectoryEntry[] = peers.map((p) => {
    const connected = connectedIds.has(p.id);
    return {
      propertyId: p.id,
      name: p.publicName || p.name,
      locality: p.locality,
      bio: p.bio,
      priceBand: p.priceBand,
      amenities: amenityByProp.get(p.id) ?? [],
      photoPaths: p.photoPaths,
      connected,
      contactPhone: connected ? p.contactPhone : null,
    };
  });

  return entries.filter((e) => matchesFilters(e, filters));
}
