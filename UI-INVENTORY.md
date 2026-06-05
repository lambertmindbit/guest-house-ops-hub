# UI Inventory — Guest House Ops Hub (pre-redesign baseline)

> ⚠️ **Historical document.** This describes the UI **before** the redesign and
> was the input brief for it. The redesign shipped **2026-06-05** (navy/teal/mint
> design system, Fraunces/Plus Jakarta Sans/JetBrains Mono, mobile bottom tab bar
> + FAB, desktop sidebar, calendar Day/Week/2-Week/Month, Preferences with
> appearance/accent/density, in-app confirm dialogs). It also predates several
> screens since added (Pricing, Inbox, Invoice, the Settings sub-pages).
>
> For the **current** UI, see the live app, the design system in
> [`src/app/globals.css`](src/app/globals.css), the user-facing
> [docs/USER-GUIDE.html](docs/USER-GUIDE.html), and
> [docs/ARCHITECTURE.md → UI](docs/ARCHITECTURE.md#ui--design-system). The brief
> that drove the redesign is [docs/DESIGN-HANDOFF.md](docs/DESIGN-HANDOFF.md).
> The text below is kept as the record of where the redesign started from.

A plain-language description of every screen as it looked before the redesign,
for use as input to a UI/UX redesign (attached to a claude.ai design brief). The
app is **mobile-first** (designed for ~390px phones, scales up to desktop), built
with Next.js App Router + Tailwind CSS v4, installable as a PWA.

## Current visual language (what to improve)
- **Palette:** mostly Tailwind neutrals — white cards on a light grey (`neutral-50`) page, `neutral-200` borders, `neutral-900` (near-black) primary buttons. Functional accents: green = confirmed/clean, amber = warnings/cleaning, red = conflicts.
- **Channel badges:** small coloured pills — Direct (green), WhatsApp (emerald), Booking.com (blue), Agoda (rose), MakeMyTrip (orange).
- **Shapes/type:** `rounded-lg` cards and buttons, `system-ui` font, generally small text. Tables for finance/analytics.
- **Overall feel:** clean but plain/utilitarian — functional, not warm or distinctive. This is the main thing to elevate.

---

## Global shell

**Top navigation bar** (sticky, white, on every screen except Login):
- Left: brand text "Ops Hub".
- Tabs: Today · Calendar · Guests · Cleaning · Finance · Analytics · Conflicts · Feeds. Active tab is a black pill.
- Right: black "+ New" button (new reservation) and a "Logout" link.
- On a phone the row **scrolls horizontally** (8 tabs don't fit) — a known ergonomic weak point; a bottom tab bar or grouped menu would suit mobile better.

---

## 1. Login (`/login`) — public, no nav
Centered narrow column: "Ops Hub" heading, subtitle "Sign in to continue.", Email field, Password field, full-width black "Sign in" button. Errors show as a red banner above the form.

## 2. Today dashboard (`/`) — the landing screen
- Header: "Today" + the date.
- **Alert banners** (only when relevant): red "⚠️ N booking conflicts need attention" → links to Conflicts; amber "🧹 N rooms to clean" → links to Housekeeping.
- **Stat cards** (2 columns on phone, 4 on desktop): Occupancy % (with rooms ratio), In-house, Check-ins, Check-outs.
- **Four list sections** (1 column phone, 2 on desktop): "Check-ins today", "Check-outs today", "In-house now", "Arrivals next 7 days". Each row = a card with guest name, "Room X · RoomType (· arr time)", and a channel badge (arrivals also show the date).
- Empty sections show a dashed-border "Nothing booked yet." placeholder.

## 3. Unified calendar (`/calendar`)
- Header "Calendar" + week navigation buttons: "‹ Prev", "Today", "Next ›".
- **Legend:** coloured squares for Vacant / Occupied / Blocked / Conflict, plus thin bars for Arriving (green) / Departing (amber).
- **Grid:** a horizontally scrollable table, **14 day-columns**. First column (room label + type) is sticky. Column headers show weekday + day; today's column is tinted amber.
- **Cells** are colour-coded: white = vacant, blue = occupied (shows guest first name + channel name, clickable → reservation), grey = blocked ("Blocked" + reason), red = conflict. Left green edge = arriving that day; right amber edge = departing.
- Dense and a bit cramped on mobile; the colour system and density are prime redesign targets.

## 4. Reservation detail (`/reservations/[id]`)
- "‹ Back to calendar" link.
- Header: guest name + phone, and a status pill (confirmed = green, cancelled = grey, no_show = rose).
- **Detail card** (label/value rows): Room, Channel (badge), Check-in, Check-out, Arrival time, Amount, OTA ref, Special requests.
- **Payments panel:** "Collected X / Y", a green "Fully paid" or amber "Balance due Z" bar, list of payments (amount · mode · date, each removable), and an inline add-payment form (amount + mode dropdown + "Add payment").
- Black "Edit reservation" button.

## 5. New / Edit reservation form (`/reservations/new`, `/reservations/[id]/edit`)
Stacked form: Guest name + Phone (new) or read-only guest (edit); Channel dropdown; Room dropdown; Check-in + Check-out (two date inputs side by side); Arrival time + Amount (side by side); Special requests textarea; full-width black submit. Edit mode also shows a red-outlined "Cancel reservation" button. Overlap/validation errors show as a red banner at the top.

## 6. Guests (`/guests`)
Search box + "Search" button; a result count line; a list of guest cards (name, then phone · email, with a "N stays" count on the right). "Clear search" link when filtered.

## 7. Housekeeping (`/housekeeping`)
- Summary line ("N rooms to clean" / "All rooms are clean").
- **"To clean"** section: room cards, priority first. High-priority cards are red with an "Arriving today — clean first" tag; cards also show "Arrival today" / "Occupied tonight" tags and "Checked out <date>". Each has a green "Mark clean" button.
- **"Ready"** section: clean rooms, each with a subtle "Needs cleaning" button to flag manually.

## 8. Finance (`/finance`)
- Date-range picker (From / To / Apply), defaults to current month.
- **KPI cards** (2/4 col): Gross revenue, OTA commission, Net to you (green), Outstanding (amber if > 0).
- **"By channel" table:** Channel | Bookings | Gross | Commission | Net.
- **"Balances due"** list: amber rows linking to each booking that still owes money.

## 9. Analytics (`/analytics`)
- Date-range picker (defaults to current month).
- **KPI cards** (2/3 col): Occupancy %, ADR, RevPAR, Avg stay (nights), Cancellation %.
- **"Source mix" table:** Channel | Bookings | Room-nights | Share %.

## 10. Conflicts (`/conflicts`)
List of red cards, one per clash: "Room X · overlap <dates>", the booking (guest + dates), the block (reason + source), and an "Open reservation →" link. Empty state: "No conflicts — everything lines up. 🎉".

## 11. Feeds (`/feeds`)
- **"Export to OTAs"** section: one card per room with its read-only `.ics` URL (monospace) + a "Copy" button.
- **"Import from OTAs"** section: a "Sync now" button, an add-feed form (Room dropdown + Label + iCal URL + "Add feed"), and a list of import feeds showing label · room, the URL, last-synced/last-error status, and a "Remove" button.

---

## What a redesign should preserve (functionally)
- The colour-coded calendar **states** (vacant/occupied/blocked/conflict + arriving/departing) — these encode real meaning.
- **Channel badges** as quick at-a-glance source identifiers.
- The **alert banners** (conflicts, cleaning) on the dashboard.
- **Status pills** (confirmed/cancelled/no_show), **balance-due** emphasis, and **high-priority** housekeeping flagging.
- Every screen must stay **usable one-handed on a phone** and still scale to desktop.

## Suggested redesign priorities
1. A warmer, more distinctive **brand palette + typography** (it currently reads generic).
2. **Mobile navigation** — replace the horizontally-scrolling top tabs with a bottom tab bar (or a "More" menu) for the 8 destinations.
3. **Calendar** density/legibility on small screens.
4. Consistent **card / list / table** components with more breathing room and clearer hierarchy.
