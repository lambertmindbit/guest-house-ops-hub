# Ops Hub — Redesign Implementation Guide (for Claude Code)

> **Audience:** Claude Code working in the real Next.js 15 codebase (`guest-house-ops-hub`).
> **Goal:** Re-skin and re-architect the app to the aesthetic in the Mindbit invoice app's
> `UI_GUIDELINES.html` — navy ink + teal + mint, Fraunces/Plus Jakarta Sans/JetBrains Mono,
> tight density, hairline tables, one navy "verdict" panel per page — **and** fix the IA / nav
> problems flagged in the design review.
>
> **Reference mockup (source of truth for look & behaviour):** the HTML/React prototype in
> `Ops Hub - Redesign.html` + the `redesign/` folder. It is plain React-on-Babel, not the real
> stack, but every screen, token, and component there is the intended target. When in doubt about
> spacing, colour role, or layout, open the mockup and match it. The CSS in `redesign/tokens.css`,
> `redesign/components.css`, `redesign/shell.css` is written to be **portable** — port it into the
> real `globals.css`, don't reinvent values.

---

## 0. Hard rules (do not violate — from CLAUDE.md §constraints)

1. **No new heavy UI/design dependencies.** No component library, no CSS-in-JS runtime, no Tailwind
   plugins beyond what's installed. The system stays **CSS custom properties + thin Tailwind v4
   utility classes + small `.ui` component classes**. Lucide icons (already inline SVG in `ui.tsx`)
   are fine.
2. **Theming via `data-*` on `<html>`** must keep working: `data-appearance` (light/dark/system),
   `data-tint`, plus the two new ones below. Read/write them exactly as the current `NavShell`
   appearance toggle does.
3. **Tailwind v4, App Router, TS strict.** No `any`. Server components stay server; only files that
   need state get `"use client"` (as today).
4. **Mobile-first ~390px.** Design phone-first; widen to desktop with `@media (min-width: 900px)`.
5. **Derived availability calendar with a loud red conflict state.** Never store "is booked" — derive
   from reservations/blocks as today. Conflicts render in saturated red (`--red`) in every view.
6. **Distinct channel badges** (Direct/WhatsApp/Booking.com/Agoda/MakeMyTrip) — keep colours distinct
   and meaningful. Spec in §4.
7. **PWA + safe-area, a11y (focus/contrast/reduced-motion), clean invoice print** — preserved. §9.
8. **No emoji, no unicode-glyph icons** (`→ ★ ✓` as icons). Stroke SVG only. Sentence case for
   headings; Title Case only for nav items / proper nouns; ALL-CAPS only for eyebrow labels.

---

## 1. Visual system → `globals.css`

The real `globals.css` currently holds the "Apple edition" tokens. **Replace that token block** with
the ported system below. Keep the Tailwind `@import "tailwindcss";` at the top and any
`@theme`/`@layer` plumbing; only swap the custom-property values and the component classes.

### 1.1 Fonts

Load three families (replace Poppins-only). Use `next/font` in `app/layout.tsx` (preferred — no FOUT,
self-hosted) **or** a `<link>` to Google Fonts. Names the CSS expects:

```ts
// app/layout.tsx
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
const ui = Plus_Jakarta_Sans({ subsets:["latin"], weight:["400","500","600","700"], variable:"--font-ui" });
const display = Fraunces({ subsets:["latin"], weight:["500","600","700"], variable:"--font-display" });
const mono = JetBrains_Mono({ subsets:["latin"], weight:["400","500","600"], variable:"--font-mono" });
// add `${ui.variable} ${display.variable} ${mono.variable}` to <html className>
```

- **Fraunces** → display/page titles only (`.display`).
- **Plus Jakarta Sans** → all UI/body.
- **JetBrains Mono** → numerals in tables/KPIs, times, eyebrow micro-labels. Apply via
  `font-variant-numeric: tabular-nums` + `var(--font-mono)` on `.num`/`.money`/timestamps.

### 1.2 Tokens

Port **verbatim** from `redesign/tokens.css` (`:root`, `[data-appearance="dark"]`, the
`[data-tint="…"]` blocks, `[data-density="…"]`). Key roles:

| Role | Token | Light value |
|---|---|---|
| Ink / primary button / verdict panel | `--navy` | `#0b1c30` |
| Accent (links, money, focus, primary hover) | `--teal` / `--accent` | `#006b5f` |
| Highlight on dark, small accents | `--mint` | `#5eead4` |
| Page bg (the one) | `--page` | `#f8f9ff` |
| Card | `--surface` | `#fff` |
| Inset / table header / footer | `--surface-2` | `#f8fafc` |
| Hairline | `--border` / `--border-subtle` | `#e2e8f0` / `#f1f5f9` |
| Text ramp | `--ink`→`--text`→`--text-muted`→`--text-subtle`→`--text-faint` | `#0b1c30`→…→`#94a3b8` |
| Conflict (loud) | `--red` | `#dc2626` |
| Warn (to-clean, balance due) | `--amber` | `#d97706` |

Radii: **6 / 10 / 16** (`--r-sm/md/lg`) + `999px` only for the round +FAB and avatars. **No pills on
buttons.** Type scale: `--fs-display:28` down to `--fs-eyebrow:10`; never below 11px for content.

### 1.3 New `data-*` knobs

Keep `data-appearance` and `data-tint` (tints: `teal` default, `navy`, `blue`, `violet`). The
"material/btnshape" knobs from the Apple build are **dropped** — replace with **`data-density`**
(`comfortable` default | `compact`, which tightens `--card-pad`/`--row-pad-y`/`--fs-display`). Wire a
Preferences control (appearance + accent + density) — see the mockup's `Prefs` popover in
`redesign/app.jsx` for the exact UI. Persist to `localStorage` and reflect onto `<html>` on mount
(mirror the existing appearance-toggle code in `NavShell.tsx`).

### 1.4 Component classes

Port the `.btn*`, `.card*`, `.ch*` (channel), `.badge*`, `.kpi-strip/.kpi-panel`, `.input/.select/
.textarea`, `.chip*`, `.banner*`, `.tbl*`, `.section-label`, `.rowcard*`, `.progress`, `.avatar`,
`.setlist/.setrow`, `.switch` classes from `redesign/components.css` + the calendar/nav classes from
`redesign/shell.css`. They already use only the tokens above. Map the current `ui.tsx` helpers
(`Btn`, `Card`, `Badge`, `Icon`, etc.) onto these class names rather than re-deriving Tailwind soup.

---

## 2. Information architecture & navigation → `NavShell.tsx`

> **This section was rewritten for the round-2 consolidation.** The app grew to ~24 visible
> destinations (15 top-level in `META` + 7 setup modules promoted inline in the desktop sidebar +
> Preferences/Log out). The goal is to collapse that to a small primary set + shallow grouped
> secondary areas. Reference: direction-A column of `Ops Hub - Directions.html` and the live
> prototype `Ops Hub - Redesign.html` (`redesign/app.jsx` + `redesign/screen-more.jsx`).

**Principle — three tiers:** *Do* (daily, ≤1 tap from Today) · *Find* (Calendar, Bookings, Guests) ·
*Manage* (one grouped "More"/sidebar area). Keep driving **both** phone and desktop from **one config**.

### 2.1 The two consolidations that do the work
1. **"Needs you" = Conflicts + Escalations merged.** Both are "a decision only you can make." One
   destination, one count badge (`conflicts + escalations`), surfaced as the Today banner. New route
   **`/needs-you`** renders two sections — *Booking conflicts* (from `getConflicts()`) and *Approvals*
   (from `escalations.ts` `listEscalations`). Keep `/conflicts` and `/escalations` as working deep
   links if you like, but **remove them from nav** — only `/needs-you` appears.
2. **"Setup" = one door.** The 7–8 setup modules (Property, Room types, Rooms, Channels, Pricing
   rules, Blocked dates, **Feeds** = iCal config, **Scam numbers** = `/settings/flagged-numbers`)
   collapse behind a single **"Property setup"** entry → the `/settings` hub (the master/detail hub
   from §3.5). They must **not** be listed inline in the sidebar or the phone hub anymore.

### 2.2 Phone (`< 900px`) — bottom bar + raised New
Five slots: **Today · Calendar · ＋New · Bookings · More**.
- **Bookings** (`/reservations`, nav-labelled "Bookings", icon `bed`) — the **searchable** reservation
  list (search by guest/room/channel). Kept as a primary tab per owner's request.
- **＋New** = raised round navy FAB → `/reservations/new`.
- **More** is a **full grouped hub _screen_** (new route **`/more`**), NOT a bottom sheet. Groups:
  - **Operate:** Guests · Cleaning · Needs you `(badge)`
  - **Business:** Finance · Pricing · Analytics
  - **Review:** Inbox · Messages
  - **Setup:** one row → "Property setup" (`/settings`)
  - **System:** Help · Preferences · Log out
  Rows use the `.setlist/.setrow` pattern (icon tile + title + one-line summary + chevron). See
  `MoreHub` in `redesign/screen-more.jsx`.
- **Guests** moves off the bar into the More hub **and** is reachable from the header/global search
  (search covers guests + bookings). Replace the old horizontally-scrolling top tabs entirely.
- Safe-area: `padding-bottom: env(safe-area-inset-bottom)` on the bar; bottom padding on scrollers.

### 2.3 Desktop (`≥ 900px`) — left sidebar, same config, regrouped
```ts
const SIDEBAR_GROUPS = [
  { label:"Operate",  items:["today","calendar","bookings","guests","housekeeping","needsyou"] },
  { label:"Business", items:["finance","pricing","analytics"] },
  { label:"Review",   items:["inbox","messages"] },
  { label:"Setup",    items:["settings"] },            // single "Property setup" entry
];
// bottom of sidebar: Preferences, Log out
```
- `needsyou` shows a red badge = `conflictCount + escalationCount`.
- There is **no "More"** on desktop — the sidebar already shows everything; `/more` is phone-only.
- Top toolbar: page title (Fraunces) + global search (guests + bookings) + appearance toggle +
  primary "New booking".
- This removes ~12 inline links from the sidebar (the 7 setup modules + conflicts/escalations/feeds
  folded away). Net visible: ~12 + 3 system, down from ~24.

### 2.4 Active-route logic
`activeId(pathname)`: `today`/`calendar`/`bookings` map to themselves; `/reservations/new` and
`/reservations/[id]` → **`bookings`**; `/needs-you`, `/conflicts`, `/escalations` → **`needsyou`**;
`/settings/*` → `settings`; everything else → its own sidebar item (desktop) or **`more`** (phone).

### 2.5 Route changes summary
- **Add:** `/needs-you` (merged conflicts + approvals), `/more` (phone hub screen).
- **Relabel in nav:** `/reservations` → "Bookings"; `/settings` → "Property setup".
- **Remove from nav (keep routes as deep links):** `/conflicts`, `/escalations`, `/feeds`,
  `/messages`* and the 7 `/settings/*` modules — all reachable via Needs you / Review / Setup, not as
  standing top-level links. (*Messages stays nav-visible under Review.)
- **No API/data-model changes** — `/needs-you` and `/more` are new *pages* composing existing
  `src/lib/*` reads (`getConflicts`, `listEscalations`); `/reservations` already exists.

---

## 3. Per-screen specs (priority order)

For each, the mockup screen file is the reference implementation.

### 3.1 Today — `app/page.tsx` (+ client island for the collapsible) — ref `screen-today.jsx`
- **Order (actions-first):** title → **"Needs you" banner** → compact 3-up stat strip → Arrivals
  today → **To clean (promoted card)** → Departures today → In-house (collapsed) → Next 7 days (peek).
- **One merged banner:** "**N things need you** — X booking conflict, Y approval" → `/needs-you`,
  where N = `conflictCount + escalationCount`. Replaces the separate conflict banner. Keep the copy
  grammatical ("needs"). No emoji.
- **Compact 3-up stat strip** (`.kpi-strip.kpi-strip--3`): navy **Occupancy verdict** (`83%` /
  `5 of 6 rooms`) + **Arrivals** (today) + **Departures** (today). KPIs no longer lead with four
  stacked blocks — the day's to-do wins the top of the screen.
- **Housekeeping promoted to a card on Today** (not just a banner): a `.clean-card` with a "To clean"
  section header (+ link to `/housekeeping`), `.room-chip`s (priority/arriving rooms in red), and a
  "Mark a room clean" primary button. This is the morning routine — it belongs on the dashboard.
- **De-duplicate:** In-house stays collapsed and is the only full in-house list; Arrivals/Departures
  are the to-do. Don't repeat arrivals inside in-house.
- Data: compose `getTodaySummary()` + `getConflicts()` + `getHousekeeping()` + escalation count
  (already a 60s `unstable_cache` join in the layout) — no new queries.

### 3.1a Bookings — `app/reservations/page.tsx` — ref `Bookings` in `screen-more.jsx`
- The reservations list, now a **primary tab labelled "Bookings"**, **searchable** by guest / room /
  channel (client-filter over the server-rendered list, or a `?q=` server filter — either; keep it
  instant on phone). Row = avatar initials + name + room/type + channel badge + when/status. Tap →
  `/reservations/[id]`. Empty state: "No bookings match '…'."

### 3.1b Needs you — `app/needs-you/page.tsx` (new) — ref `NeedsYou` in `screen-more.jsx`
- Two labelled sections: **Booking conflicts** (`getConflicts()`) — the loud red conflict card with
  "Open reservation" / "Remove block"; and **Approvals** (`listEscalations`) — per item: title,
  severity badge, source ("From … assistant"), note, "Review & approve" / "Dismiss". Count badge in
  nav = sum of both. Back-chevron → Today.

### 3.1c More hub — `app/more/page.tsx` (new, phone-only) — ref `MoreHub` in `screen-more.jsx`
- Global search field (guests + bookings) + the grouped `.setlist` rows from §2.2 (Operate /
  Business / Review / Setup / System). Needs-you row carries the count badge. Setup is one row.
- Desktop never routes here (redirect `/more` → `/` on `≥900px`, or just let the sidebar own it).

### 3.1d Review surfaces — `app/inbox/page.tsx`, `app/messages/page.tsx` — ref `Inbox`/`Messages`
- **Inbox** (`InboundBooking`): staged OTA emails as cards (guest, channel badge, room · dates, ref)
  with "Confirm booking" (→ `/reservations/new` prefilled) / "Dismiss". Unchanged data path (§ARCH
  OTA ingestion). **Messages** (`OutboundMessage`): logged-send cards (to, channel, status, body,
  when). Both live under the "Review" group; restyle to the system, no behaviour change.

### 3.2 Calendar — `app/calendar/page.tsx` + `RateCalendar.tsx` sibling — ref `screen-calendar.jsx`
- **Segmented Day / Grid toggle.** **Phone defaults to Day; desktop defaults to Grid.**
- **Day view:** horizontal date strip (`.daystrip/.daycell`, selected = navy) → per-room list
  (`.dayrow`): room no/type, guest, channel badge, and bold **ARRIVES/DEPARTS** mini-flags. Vacant =
  dashed muted row; blocked = hatched; **conflict = red row, 1.5px red border, "RESOLVE" flag** →
  links to `/conflicts`. Never truncates.
- **Grid view:** rooms × dates table, sticky room column + sticky header, horizontal scroll.
  Occupied = teal tint + channel-colour dot + name (ellipsis, never wraps to "Booking.c"). Arr/dep =
  4px green/orange edge bars. **Conflict cell = solid red.** Legend below.
- Replace the current text-in-cell channel + blue "occupied". Occupied = `--accent-bg` teal tint.

### 3.3 New / Edit reservation — `ReservationForm.tsx` — ref `screen-reservation.jsx` (`NewReservation`)
- Sections with accent eyebrows: **Guest** (phone first → autofill known guest by phone), **Stay**,
  **Channel**, **Details & payment**.
- **Stay = error prevention:** show check-in/out, compute **nights**, and render the room picker as
  **chips where only rooms actually free for those dates are enabled** (disabled = struck-through).
  The form already fetches `rooms` + a `quote`; add an availability filter so an overlapping room
  can't be picked. Keep the server-side conflict guard as a backstop, surfaced as an inline banner —
  but it should now be the rare exception.
- Channel = chips with colour dots. Sticky "Save booking" action at the bottom (thumb-reach) on phone.
- **Live nights:** compute and show "{n} nights" from the two dates as they change (ref `NewReservation`).
- **Foreign-national C-Form:** a toggle in the Guest section ("Collect C-Form registration details")
  reveals a registration card — **Nationality, Passport no., Date of entry, Port of entry, Purpose**
  (maps to the `Guest` C-Form fields in the schema). Only persist these when the toggle is on.
- **Scam-list guard:** as the phone is typed, match against `FlaggedNumber` (`/api/.../flagged`); on a
  hit show a red inline `field-error` ("On the scam list — {reason}") **and disable Save** until
  resolved. This is the booking-time warning the `FlaggedNumber` model exists for.

### 3.4 Reservation detail — `app/reservations/[id]/page.tsx` + `StayActions.tsx` — ref `ReservationDetail`
- Header: avatar (initials, navy/mint) + name + **status badge** + phone + channel badge.
- One info card: room/type + amount, then check-in / check-out / nights / arrival, then requests.
- **Hero action = contextual** (`StayActions`): "Check in guest" when confirmed-not-arrived,
  "Check out guest" when in-house — full-width navy button. This is the primary action, **not Edit**.
- Payments card: progress bar + ledger + "Add payment".
- Footer row: **Edit · Invoice · ⋯** — put destructive **Cancel** inside the overflow/secondary,
  never a peer of Edit (`CancelReservationButton` moves into the overflow menu).
- **Registration row** in the info card: "ID on file" status (and, for foreign guests, a C-Form
  badge) so the owner can see at a glance whether registration is complete.
- **Message guest** secondary action (full-width ghost) → logs/sends via the messaging seam and shows
  in `/messages` (ref `ReservationDetail`).

### 3.5 Settings — `app/settings/page.tsx` + `SettingsClient.tsx` — ref `screen-settings.jsx`
- **Kill the single-open accordion.** Replace with a **grouped hub list → focused sub-page** (one
  thing on screen, back-chevron returns). Groups: Property (**one** Property details page — name,
  address, currency, GST **and** check-in/out times together, matching the existing single Property
  section in `SettingsClient`; do NOT split times into its own row), Inventory (Room types, Rooms),
  Channels, Pricing (Pricing rules), Maintenance (Blocked dates), **Safety (Scam numbers)**.
- Each row = icon tile + title + one-line summary + chevron (`.setlist/.setrow`). Each opens its own
  route (`/settings/channels`, `/settings/rooms`, …) — convert `SettingsClient`'s accordion sections
  into sub-pages (or a `?section=` focused panel if you must keep one route, but real routes are
  better for back-button + deep-link).
- Desktop: render the hub as a left column + detail pane (master/detail) — same drill-in widened.
  Mocked in `screen-settings.jsx` as `.set-md` (sticky section list left, active sub-page right;
  pass a `desktop` flag); phone keeps the full-screen drill-in.
- The **Channels** sub-page is fully specced in the mockup (commission + "collects payment" per
  channel) — build that one in full; stub the rest to match.
- **CRUD actions per sub-page** (all mocked — each manage row carries the right controls):
  - Room types → **Add · Edit · Delete** · Rooms → **Add · Archive/Unarchive · Delete** ·
    Channels → **Add · Edit · Delete** · Blocked dates → **Add · Remove** · Pricing → **Save**;
    Seasons → **Add · Edit · Delete**.
  - Use the mockup's compact `RowActions` pattern: a ghost pencil (Edit) + a danger trash (Delete)
    icon pair, ≥34px tap targets, `aria-label` on each.
  - ⚠ **Gaps to close in the current code:** **Seasons have no Edit** in `SettingsClient` today
    (only Add + Delete) — add an edit flow (reuse the add-season form pre-filled, PATCH `/api/seasons/[id]`).
    Audit every list section and ensure Edit + Delete both exist wherever a record can change.

### 3.6 Settings sub-page field specs (build each as its own route)

All field names, types, defaults, and endpoints below are taken from the existing `SettingsClient.tsx`
and `/api/*` routes — keep the same payload shapes so the API layer is untouched. Each sub-page = a
focused route under `/settings/*`, hub row → drill in → back-chevron returns.

**`/settings/property` — Property details** (one combined page; `PATCH /api/settings`)
| Field | Control | Default / source | Notes |
|---|---|---|---|
| Property name * | text, required | `settings.name` ("My Guest House") | |
| Address | text | `settings.address` (nullable) | "Used on printed invoices." Send `null` if empty. |
| Currency | text | `settings.currency` ("INR") | |
| GST number | text | `settings.gstNumber` (nullable) | Optional; send `null` if empty. |
| Check-in time | `type="time"` | `settings.checkInTime` ("14:00") | Defaults onto every new booking. |
| Check-out time | `type="time"` | `settings.checkOutTime` ("11:00") | |
| Timezone | (read-only note) | `settings.timezone` ("Asia/Kolkata") | Show as helper text; drives "today"/arrivals/calendar. |
- Single **Save property** button; inline success ("Saved") + error line. No Add/Delete.

**`/settings/room-types` — Room types** (`POST /api/room-types`, `PATCH /api/room-types/[id]`, `DELETE /api/room-types/[id]`)
- List card per type: name (h3) + badges `₹{baseRate} base · Sleeps {maxOccupancy} · {roomCount} rooms`
  + helper `Rate range ₹{rateFloor} – ₹{rateCeiling}`. Row actions: **Edit · Delete**.
- Add/Edit form fields (all required): **Name** (text), **Base rate ₹** (number ≥0), **Max occupancy**
  (number ≥1), **Rate floor ₹** (number ≥0), **Rate ceiling ₹** (number ≥0).
- Delete confirms (`Delete room type "<name>"?`); blocked by API if rooms reference it.

**`/settings/rooms` — Rooms** (`POST /api/rooms`, `PATCH /api/rooms/[id]` for archive, `DELETE /api/rooms/[id]`)
- Row per room: `Room {label}` + `{roomTypeName}`; archived rooms render at 0.65 opacity with an
  "Archived" badge. Row actions: **Archive/Unarchive · Delete**.
- Add form: **Label** (text, required, e.g. "302") + **Room type** (select of room types, required).
- Delete confirms and only succeeds if the room has no bookings (API-enforced).

**`/settings/channels` — Channels** (`POST /api/channels`, `PATCH /api/channels/[id]`, `DELETE /api/channels/[id]`)
- Row card: colour dot + name + `{commissionPct}% commission · {collectsPayment ? "collects payment" : "you collect"} · {resCount} bookings`. Row actions: **Edit · Delete**.
- Add/Edit form: **Name** (text, required), **Commission %** (number 0–100, step 0.01),
  **Collects payment** (checkbox: "This channel collects payment from the guest").

**`/settings/pricing` — Pricing rules** (`PATCH /api/pricing/policy`; seasons via `POST /api/seasons`, `PATCH /api/seasons/[id]` ⟵ NEW, `DELETE /api/seasons/[id]`)
- Intro: "Advisory only — suggests a nightly rate and pre-fills new bookings, clamped to each room
  type's floor/ceiling. Never pushed to OTAs."
- **Policy** (`enabled`, `weekendDays:number[]`, `weekendAdjustPct`, `leadEarlyDays`,
  `leadEarlyAdjustPct`, `leadLateDays`, `leadLateAdjustPct`, `occupancyThresholdPct`, `occupancyAdjustPct`):
  - **Pricing engine** toggle (`switch`).
  - **Weekend:** 7 day-chips (Su–Sa, multi-select → `weekendDays`, default `[5,6]`) + **Weekend
    adjustment %** (number; default 20).
  - **Lead time:** Early-bird if ≥ days (number, nullable) · Early-bird % · Last-minute if ≤ days
    (number, nullable) · Last-minute %. Empty → `null`.
  - **Occupancy — high demand:** When occupancy ≥ % · Adjustment %.
  - **Save pricing rules** button + inline saved/error.
- **Seasons & holidays** list: card per season `{name}` + `{startDate} → {endDate}` + `{adjustPct>0?"+":""}{adjustPct}%`
  badge. Header **+ Add season**. Row actions: **Edit · Delete** (Edit is the new flow). Add/Edit
  fields: **Name** (text, required), **From** (date, required), **To** (date, required),
  **Adjustment %** (number, required).

**`/settings/blocks` — Blocked dates** (`POST /api/blocks`, `DELETE /api/blocks/[id]`)
- Intro: "Hold a room out of service (repairs, deep clean, owner use). Blocked dates can't be booked
  and show on the calendar."
- Row card: `Room {roomLabel}` + `{startDate} → {endDate}{reason ? " · " + reason : ""}`. Action: **Remove**.
- Add form: **Room** (select, required), **From** (date, required), **To / checkout day** (date,
  required), **Comment / reason** (text, optional).
- If a block overlaps a live reservation it becomes a **conflict** — surface a link to `/conflicts`
  (the mockup shows this hint on the Room 102 block).

**`/settings/flagged-numbers` — Scam numbers** (`POST` / `DELETE /api/flagged-numbers` — `FlaggedNumber` model)
- Intro: "Phones on this list trigger a warning when you start a booking — so a known bad actor can't
  slip through." Lives under a **Safety** group in the hub.
- Row: red `ban` tile + `{phone}` (mono) + `{reason} · added {date}`. Action: **Remove**.
- Add form: **Phone** (text, required, unique) + **Reason** (text). Consumed by the booking-form
  scam-list guard in §3.3.

---

## 4. Channel badges (shared) → `ui.tsx`

One `<ChannelBadge name>` component, dot + label, 6px radius, tabular nothing. Colour map:

| Channel | class | bg / text token |
|---|---|---|
| Direct | `ch--direct` | teal `--teal-bg` / `--teal-pill-text` |
| WhatsApp | `ch--whatsapp` | green `--green-bg` / `--green-text` |
| Booking.com | `ch--booking` | blue `--blue-bg` / `--blue-text` |
| Agoda | `ch--agoda` | rose `--rose-bg` / `--rose-text` |
| MakeMyTrip | `ch--makemytrip` | orange `--orange-bg` / `--orange-text` |

Grid view uses the solid dot colours (`CH_DOT` map in `redesign/screen-calendar.jsx`).

---

## 5. Secondary screens — full specs (ref files in parens)

Apply the new tokens/components throughout. The screens below were stubs/low-fidelity and now have
full mockups.

- **Finance** (`app/finance/page.tsx`, ref `screen-misc.jsx`): navy "Net to you" verdict KPI +
  Gross / Commission / Outstanding (amber). "By channel" table **must scroll** on mobile — wrap in
  `.tbl-wrap` (`overflow-x:auto`); never clip the Net column. Balances-due list links to reservations.
- **Analytics** (`app/analytics/page.tsx`, ref `Analytics` in `screen-insights.jsx`): real dashboard,
  not a stub. KPI strip = navy **Occupancy** verdict (with ▲/▼ delta vs prior) + **ADR** (delta) +
  **RevPAR** + **Revenue**. Then a **14-day occupancy trend** (CSS bar row, `.trend`), a **source-mix**
  breakdown (`.mixrow` labelled bars, % per channel), and **occupancy by room type**. Source data:
  `analytics.ts` (occupancy/ADR/RevPAR/source mix). Equal-height panels via `.kpi-strip`.
- **Pricing page** (`app/pricing/page.tsx`, ref `Pricing` in `screen-insights.jsx`): the **advisory
  rate view** (distinct from `/settings/pricing` which edits the *rules*). A rules summary banner
  (→ `/settings/pricing`), then **per-room-type cards** each showing base rate, floor–ceiling, and a
  **7-night rate strip** (`.rate-strip`/`.rate-cell`) with weekend nights highlighted and the +% tag;
  rates come from `pricing.ts` `quoteRoomType` (clamped to floor/ceiling). Seasons-in-effect list below.
- **Guests** (`app/guests/page.tsx`, ref `Guests` in `screen-misc.jsx`): real directory — live search
  by name/phone, stay count, and badges from the `Guest` model: **Flagged** (red, `blocked`/scam),
  **Foreign · C-Form** (`nationality` present), **₹ balance due**. Blocked guests get a red avatar.
- **Calendar Day view** (`app/calendar/page.tsx`, ref `screen-calendar.jsx`): above the room list show
  an **availability summary** ("{booked} of {total} booked · {free} free") + an occupancy `.progress`
  bar. **Vacant rows are tappable** with a "+ Book" chip → `/reservations/new` (prefill room+date);
  occupied → detail, conflict → `/needs-you`. Footer: New booking + Block a room.
- **Conflicts**: folded into **Needs you** (§3.1b) — no standalone screen needed; drop the unicode "→".
- **Housekeeping**: "arriving — clean first" uses red **only** for genuine urgency; "occupied tonight"
  stays a neutral/blue badge so red keeps meaning.

---

## 6. Cross-cutting fixes
- **One date format** everywhere: `Mon, 1 Jun 2026` (or `1 Jun` compact). Centralise a `formatDate`
  helper; replace the four current formats (`2026-06-01`, `01/06/2026`, etc.).
- **Kill inline magic numbers** (12.5px, 13.5px…). Everything reads `--fs-*`, `--s*`, `--r-*`.
- Grammar pass: "needs", sentence case, no ALL-CAPS sentences.

---

## 7. Accessibility, dark mode, print (preserve)
- Tap targets ≥ 44px (FAB 52, tab labels tall). Visible focus ring `--ring`/`--focus` on every
  interactive element. `prefers-reduced-motion: reduce` → disable transforms/animation (the token
  file already has the media query — keep it).
- Dark mode: `[data-appearance="dark"]` darkens the surface ramp, teal/mint stay vivid, AA contrast
  both themes. Verify the conflict red still reads on dark (`--red-bg/-text/-border` are remapped).
- **Invoice print** stays clean: keep the print stylesheet; hide nav/tabbar/sidebar in `@media print`,
  black-on-white, no card chrome. Don't regress this.

---

## 8. Suggested commit slices (one screen per slice, matches the rebuild order)
1. `feat(theme): port redesign tokens + fonts into globals.css; add data-density` (no visual wiring yet)
2. `feat(nav): single-config NavShell — phone bottom tabs + FAB + grouped More sheet; desktop grouped sidebar`
3. `feat(today): trim + de-dup, navy verdict KPI strip, banner links`
4. `feat(calendar): Day/Grid toggle, mobile Day agenda + availability bar + vacant→book, loud red conflicts`
5. `feat(reservation-form): availability-filtered rooms + live nights + C-Form toggle + scam-list guard`
6. `feat(reservation-detail): contextual hero action, registration row, message guest, destructive in overflow`
7. `refactor(settings): accordion → grouped hub + sub-pages (incl. Scam numbers) + desktop master/detail`
8. `feat(bookings|needs-you|more): searchable Bookings, merged Needs you, phone More hub`
9. `feat(insights): real Analytics (trend + source mix) and advisory Pricing page; Guests directory badges`
10. `style(secondary): re-skin finance (fix table clip), housekeeping, inbox, messages`
11. `chore: unify date format; remove inline magic numbers; a11y + print audit`

Each slice: keep TS strict, run the dev server, verify against the matching mockup screen, commit.

---

## 9. What NOT to change
- Domain logic, Prisma schema, API routes, auth — untouched. This is a UI/IA redesign.
- The destinations stay available (owner decision) — we **regroup and consolidate** (Bookings,
  Needs you, one Setup door), we don't delete features. See §2 for the full IA.
- No new dependencies. If you think one is needed, **stop and ask** (project rule).
