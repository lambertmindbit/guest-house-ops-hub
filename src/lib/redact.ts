// Redact card / virtual-card numbers from free text before we persist it (US-306).
// We store raw OTA emails for the review screen; those bodies can carry a card or
// a single-use "virtual card" number the OTA passes for payment — data we must
// never keep (ASM-18 / Q-OTA-03).
//
// Regex-based, deliberately conservative floor of 13 digits: card/virtual-card
// numbers are 13–19 digits (optionally grouped by single spaces or dashes), while
// booking refs (≤ 12 digits), phone numbers, amounts and dates fall below it and
// are left intact. Over-redaction of a stray long digit-run is acceptable here —
// keeping a card number is not.
// A digit, then 12–18 more digits each with an optional single space/dash before
// it: 13–19 digits total, and crucially the match ends ON a digit so a trailing
// separator (the space before the next word) is never swallowed.
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;

export function redactCardNumbers(text: string): string {
  return text.replace(CARD_RE, "[redacted card]");
}
