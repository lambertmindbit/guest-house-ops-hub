// Pure UPI helpers — build a standard `upi://pay` deep link the guest can tap to
// pay the property directly. No SDK, no account: this is just the NPCI UPI URL
// scheme, so any UPI app (GPay/PhonePe/Paytm/…) handles it. A hosted checkout
// (Razorpay etc.) is deferred — it needs an SDK + merchant account (flag first).

export type UpiLinkOpts = {
  vpa: string; // payee VPA, e.g. "lawei@okhdfcbank"
  payeeName: string;
  amount?: number; // INR; omitted when 0/undefined so the guest can enter it
  note?: string;
};

// A valid VPA is `handle@bank` — alphanumerics/.-_ then @ then an alpha handle.
export function isValidVpa(vpa: string): boolean {
  return /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z][a-zA-Z0-9.\-_]{1,}$/.test(vpa.trim());
}

export function buildUpiLink({ vpa, payeeName, amount, note }: UpiLinkOpts): string {
  const parts = [
    `pa=${encodeURIComponent(vpa.trim())}`,
    `pn=${encodeURIComponent(payeeName.trim())}`,
  ];
  if (amount != null && amount > 0) parts.push(`am=${encodeURIComponent(amount.toFixed(2))}`);
  parts.push("cu=INR");
  if (note && note.trim()) parts.push(`tn=${encodeURIComponent(note.trim())}`);
  return `upi://pay?${parts.join("&")}`;
}
