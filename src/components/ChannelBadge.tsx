// Small colour-coded badge so the owner can tell a booking's source at a glance.
const STYLES: Record<string, string> = {
  Direct: "bg-green-100 text-green-800",
  WhatsApp: "bg-emerald-100 text-emerald-800",
  "Booking.com": "bg-blue-100 text-blue-800",
  Agoda: "bg-rose-100 text-rose-800",
  MakeMyTrip: "bg-orange-100 text-orange-800",
};

export function ChannelBadge({ name }: { name: string }) {
  const style = STYLES[name] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${style}`}>
      {name}
    </span>
  );
}
