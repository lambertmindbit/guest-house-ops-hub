# Design Handoff — Guest House Operations Hub

> ⚠️ **Historical — this brief has been actioned.** The redesign it requested
> **shipped 2026-06-05** (navy/teal/mint design system; Fraunces / Plus Jakarta
> Sans / JetBrains Mono; mobile bottom tab bar + FAB; desktop sidebar; calendar
> Day/Week/2-Week/Month; in-app confirm dialogs; Preferences = appearance / accent
> / **density**). Note a few details below describe the *pre-redesign* code and
> *proposed* knobs that changed in implementation — e.g. the shipped Preferences
> use a **`data-density`** control, not the proposed `data-material` /
> `data-btnshape`, and `SettingsClient` was replaced by
> `src/components/settings/sections.tsx`. Kept as the record of the design intent.
> For the current UI see [ARCHITECTURE.md → UI](ARCHITECTURE.md#ui--design-system).

> **Purpose of this document.** Hand this to a designer (or Claude Design) to do a
> fresh, critical pass on the whole app's UX/UI. The owner is **not convinced the
> current design is good enough** and wants it rethought — not just re-skinned.
> Everything you need to understand the product, who uses it, the current design
> system, every screen, and the hard technical constraints is below.

---

## 1. What this product is (in one paragraph)

A self-hosted, **mobile-first** web app (PWA) that lets the owner/staff of a **single
small guest house** run the whole property from one place: bookings, a unified
calendar, guest records, housekeeping, advisory pricing, and finances — across
several booking channels (their own website/WhatsApp, Booking.com, Agoda,
MakeMyTrip). It is **not** a channel manager; it's an internal operations hub. It
records and organises; it doesn't talk to OTA APIs.

## 2. Who actually uses it, and how

- **Primary user: the owner**, on a **phone**, standing at the front desk or walking
  the property. Often one-handed, often in a hurry, sometimes poor lighting. This is
  the case to optimise. The default and most-used view is **Today**.
- **Secondary: 1–2 staff** (housekeeping / reception) on a phone.
- **Occasional: the owner on a laptop** for finance/analytics/admin (desktop layout
  exists but is the minority case).
- **Scale is small and human:** ~5–20 rooms, a handful of bookings a day. This is not
  an enterprise dashboard. It should feel calm, fast, and obvious — closer to a
  well-made consumer app than to a SaaS admin panel.
- **Frequency:** Today / Calendar / New booking are touched many times a day.
  Settings, Finance, Analytics are occasional.

## 3. Design priorities (in order)

1. **Phone-first, thumb-first.** ~390px screen is the design target. Primary actions
   reachable with one thumb. Big tap targets. Minimal typing.
2. **Glanceability.** The owner should grasp "what's happening today / is anything
   wrong" in under two seconds. Conflicts and rooms-to-clean must surface loudly.
3. **Obviousness over density.** Few choices per screen, clear hierarchy, no jargon.
   Staff are not power users.
4. **Calm, trustworthy, modern.** It holds money and bookings; it should feel
   dependable, not flashy.
5. **Desktop is a bonus, not the brief.** Make it good, but never at the phone's expense.

## 4. The job to be done — what we want from this redesign

We want a **critical design review + a concrete redesign direction**, not a coat of
paint. Specifically:

- **Audit the current UX** screen by screen. Call out what's weak, confusing,
  cluttered, or inconsistent. Be blunt.
- **Rethink the information architecture & navigation** if it's wrong (see the known
  pain points in §8). Propose the right model for a phone-first ops app with this many
  surfaces.
- **Define a coherent visual language**: type scale, spacing system, colour roles,
  elevation, iconography, motion. It can keep or replace the current Apple-HIG
  direction — argue for your choice.
- **Redesign the key flows** end-to-end (priority order in §7): Today, Calendar, New/
  Edit reservation, Reservation detail, Settings.
- **Deliver it as something we can build**: annotated screen designs or hi-fi mockups,
  plus the token/component spec (so it maps onto our CSS-variable system — see §9).

Deliverables we'd love: (a) a short written critique, (b) the redesigned system
(tokens + core components), (c) redesigned screens for the priority flows, (d) notes
on responsive behaviour (phone → desktop) and dark mode.

## 5. The current design system (what exists today)

The current look is an **"Apple HIG / iOS edition"** built entirely with **CSS custom
properties + a small set of utility/component classes** in one stylesheet
(`src/app/globals.css`). There is **no UI component library** (no shadcn, no MUI) and
**no Tailwind component usage** beyond the `@import "tailwindcss"` reset — almost all
styling is these hand-rolled classes + inline `style={{}}` props. A redesign must
keep that "tokens + thin component classes" shape (see §9 constraints).

**Theming is token-driven and user-adjustable at runtime** via a Preferences panel:
- **Appearance:** light / dark / system (sets `data-appearance` on `<html>`).
- **Accent tint:** green / blue / indigo / warm-teal (sets `data-tint`). Warm-teal is
  the default brand accent.
- **Material:** "rich" (heavy blur/translucency) vs "crisp" (more opaque) — `data-material`.
- **Button shape:** rounded vs pill — `data-btnshape`.

**Core tokens** (abridged — full list in `globals.css`):
- Neutrals/surfaces: `--sys-bg-grouped` (app bg), `--paper` (card), `--sys-fill` /
  `--sys-fill-2` (filled controls), `--line` / `--line-strong` (separators).
- Text: `--sys-label` (primary), `--sys-label-2` (secondary), `--sys-label-3` (tertiary).
- Accent: `--tint`, `--tint-600`, `--tint-text`, `--tint-fill`.
- Status: green (`--good`), orange (`--warn`/`--clay`), red (`--danger`) each with a
  `-fill` and `-text` variant.
- Radii `--r-xs…--r-xl` + `--r-pill`; shadows `--shadow-md/-lg` (mostly flat); motion
  eases `--ease`, `--ease-spring` and durations `--fast/--base/--slow`.
- A large set of **legacy alias tokens** (`--teal-50`, `--sand`, `--cream`, `--ink`,
  `--clay`, etc.) map onto the system tokens because the screens were written against
  the old names. A redesign can rationalise these but should expect them in the markup.
- Font: **Poppins** (loaded as `--font-poppins`), fallback to the system stack.

**Component classes** that already exist (reuse/redesign these names where sensible):
`.btn` (+ `--primary/--dark/--good/--clay/--outline/--ghost/--danger-outline/--sm/--block`),
`.card`, `.pill` (status), `.ch` (channel badge), `.input`/`.select`/`.textarea` +
`.field-label`, `.banner` (alert), `.kpi`, `.tbl`, `.cal-cell` (+ occupied/blocked/
conflict/edge variants), `.empty`, `.segmented`, `.switch`, `.swatches`, plus the
**app-shell** classes below.

**Shared React components** (`src/components/ui.tsx`): `Icon` (a hand-rolled
Lucide-style stroke icon set — ~35 glyphs, `currentColor`), `ChannelBadge`,
`StatusPill`, `PageHead` (title + subtitle), `SectionLabel`, `KPI`, `AlertBanner`,
`EmptyState`, `RangeForm`, `GuestRow`.

## 6. Navigation model today

Two completely different chromes by breakpoint (in `src/components/NavShell.tsx`):

- **Mobile (<900px): iOS pattern.** A translucent sticky **top header** (brand left;
  dark-mode toggle + "＋ New" right) and a fixed **bottom tab bar** with 5 slots:
  **Today · Calendar · Guests · Housekeeping · More**. "More" opens an **iOS action
  sheet** listing the rest. A **Preferences** sheet handles theming.
- **Desktop (≥900px): macOS pattern.** A fixed top **toolbar** + a left **sidebar**
  listing *all* destinations in one flat "Menu" group, plus Account/Log out.

**Full destination list** (PRIMARY = tab bar; MORE = behind "More"/in sidebar):
`Today, Calendar, Guests, Housekeeping` (primary) · `Pricing, Finance, Analytics,
Conflicts, Inbox, Feeds, Settings` (more). That's **11 destinations** — a lot for a
phone, and a known smell (see §8).

## 7. Screen inventory (every surface, with intent)

Priority for redesign is marked ⭐ (do these first).

| Screen | Route | Purpose / contents |
|---|---|---|
| ⭐ **Today** | `/` | The home/default. Conflict + to-clean alert banners; 4 KPIs (Occupancy, In-house, Check-ins, Check-outs); lists: check-ins today, check-outs today, in-house now, arrivals next 7 days. |
| ⭐ **Calendar** | `/calendar` | Rooms (rows) × dates (cols) grid. Week / 2-week / month views; date picker; prev/next/today; "Block a room". Cells colour-coded: vacant / occupied (guest + channel) / blocked (hatched) / conflict (red) / arriving+departing edges. Horizontally scrolls on phone. |
| ⭐ **New / Edit reservation** | `/reservations/new`, `/reservations/[id]/edit` | The main data-entry form: guest, channel, room, dates, arrival time, special requests, amount (pre-filled by pricing), payment mode. Must reject overlapping bookings with a friendly error. |
| ⭐ **Reservation detail** | `/reservations/[id]` | One booking: guest, stay, channel, amount, status; check-in/out actions; payments; edit/cancel; link to invoice. |
| ⭐ **Settings** | `/settings` | Admin. **Currently a single-open accordion** of 6 sections: Property, Rooms, Room types, Channels, Pricing rules, Maintenance blocks. (This screen was reworked twice and still isn't loved — see §8.) |
| **Guests list** | `/guests` | Searchable by name/phone; rows link to detail. |
| **Guest detail** | `/guests/[id]` | Profile: stay history, repeat badge, lifetime value, ID number, blacklist toggle, notes, optional ID-document upload. |
| **Housekeeping** | `/housekeeping` | Rooms needing cleaning (derived from checkouts + a manual "needs cleaning" flag); mark-cleaned action. |
| **Pricing** | `/pricing` | Advisory rate calendar: room-types × dates of suggested nightly rates; tap a cell to pin a manual override; link to pricing rules in Settings. |
| **Finance** | `/finance` | Per-channel revenue + commission, expenses panel, net-profit KPI; CSV export buttons. |
| **Analytics** | `/analytics` | Occupancy / ADR / RevPAR / source mix etc. |
| **Conflicts** | `/conflicts` | List of overlapping/double-booking situations to resolve. |
| **Inbox** | `/inbox` | Paste an OTA confirmation email → parsed preview → create booking (groundwork feature). |
| **Feeds** | `/feeds` | iCal import/export feeds (groundwork). |
| **Invoice** | `/reservations/[id]/invoice` | Print-friendly invoice (Print → Save as PDF; print CSS strips app chrome). |
| **Login** | `/login` | Single-owner login; no nav chrome. |

## 8. Known pain points (start here — these are why we're redoing it)

1. **Settings has been the sore spot.** It began as one long page ("looks really bad
   with everything in 1 page"), then a menu→detail attempt ("yeah this doesn't work"),
   now a single-open accordion. It functions but still doesn't feel right. **Treat
   Settings' IA as an open design problem**, not solved.
2. **Too many top-level destinations (11).** The phone hides 7 behind "More". The split
   between PRIMARY and MORE is somewhat arbitrary. Reconsider the whole IA: what truly
   deserves a tab, what should be grouped, what should live inside another screen.
3. **Two different navigation paradigms** (iOS bottom-tabs vs macOS sidebar) maintained
   in parallel — a lot of surface area and a slightly split personality. Decide whether
   one coherent system can scale across breakpoints.
4. **Heavy reliance on inline `style={{}}`** with magic numbers (font sizes like 12.5px,
   13.5px, ad-hoc paddings/margins) means spacing & type are **not systematic**.
   A real type scale + spacing scale would tighten everything.
5. **Calendar on a phone** is a horizontally-scrolling grid — workable but cramped;
   worth rethinking the mobile presentation of occupancy.
6. **Visual identity is borrowed (generic Apple HIG).** It's clean but has little
   personality or sense of "this is a guest-house tool." Brand/warmth is thin.
7. **Forms** (New reservation especially) are the highest-value flow and deserve the
   most care: minimal typing, smart defaults, forgiving errors.

## 9. Hard constraints (the redesign must live within these)

**Technical (non-negotiable unless you flag and we agree):**
- **Stack:** Next.js 15 (App Router, RSC), React 19, **TypeScript strict**, **Tailwind
  CSS v4** (currently only as a reset; styling is custom-property + component classes).
- **Keep the "design tokens (CSS custom properties) + thin component classes" model.**
  Output should map to tokens + classes, not a new component-library dependency.
  **No heavy UI/design dependencies without asking first** (project rule).
- **Theming must survive:** light/dark/system, 4 accent tints, material rich/crisp,
  button rounded/pill — all driven by `data-*` attributes on `<html>` + tokens. A
  redesign can change *which* knobs exist, but theming is attribute+token driven.
- **PWA / installs to home screen.** Respect safe-area insets (the tab bar already uses
  `env(safe-area-inset-bottom)`).
- **Accessibility:** real tap-target sizes, focus states, `prefers-reduced-motion`
  respected, sufficient contrast in both themes.
- **Print:** the invoice must print clean (app chrome is hidden via print CSS).
- **Font** is currently Poppins; changeable, but it's a Google/Next font load.

**Product (from the build spec — won't change):**
- It is **mobile-first**; ~390px is the canvas. Desktop adapts up.
- **Calendar truth:** availability is *derived*; the calendar must clearly show
  vacant / occupied / blocked / **conflict (red, loud)** / arriving / departing.
- **Conflicts and double-bookings are a first-class, high-visibility concept** — the DB
  prevents them and the UI must make any conflict impossible to miss.
- Channels have **distinct badges** (Direct, WhatsApp, Booking.com, Agoda, MakeMyTrip)
  — colour-coding is meaningful, keep them differentiable.
- Money is INR by default; respect currency/locale formatting.

## 10. Where things live (for whoever implements the redesign)

- Global styles & all tokens/classes: `src/app/globals.css`
- Shared components & icon set: `src/components/ui.tsx`
- App shell / navigation: `src/components/NavShell.tsx`, `src/app/layout.tsx`
- Screens: `src/app/**/page.tsx` (see §7 for the route map)
- Feature client components: `src/components/*.tsx` (e.g. `ReservationForm`,
  `SettingsClient`, `RateCalendar`, `GuestProfile`, `PaymentsPanel`)
- A live screenshot tour / operator manual exists at `docs/USER-GUIDE.html` (open in a
  browser) — useful to see real content in each screen.

---

### TL;DR for the designer
Phone-first ops app for one small guest house, used many times a day by the owner
standing at the desk. Current look is a competent-but-generic Apple-HIG theme built on
CSS custom properties; the **IA/navigation (11 destinations) and Settings are the weak
spots**, spacing/type aren't systematic, and the brand has little personality. We want
a critical review and a buildable redesign of the system + the priority flows (Today,
Calendar, New/Edit reservation, Reservation detail, Settings), staying within the
tokens-and-classes model and the theming knobs. Be opinionated.

---

## Appendix — Prompt to start the redesign

Paste this into a fresh Claude Code session in this repo. It pairs with this document.

> Read `docs/DESIGN-HANDOFF.md` in full, then read `CLAUDE.md` for the product's hard rules. Don't write any code yet.
>
> I'm not convinced the current UX/UI is good enough and I want you to redesign it — a real rethink, not a re-skin. This is a phone-first operations app for one small guest house; the owner uses it many times a day standing at the front desk.
>
> **First, do a critical design review.** Walk the app screen by screen (the routes are mapped in the handoff §7; you can run it locally and look, and `docs/USER-GUIDE.html` shows real content per screen). Be blunt about what's cluttered, confusing, inconsistent, or off-brand. Pay special attention to the known pain points in §8: the Settings information architecture, the 11 top-level destinations, the two parallel nav paradigms, the un-systematic spacing/type (lots of inline magic numbers), and the thin brand identity.
>
> **Then propose a redesign direction** before touching code:
> 1. A revised information architecture & navigation model for a phone-first app with this many surfaces.
> 2. A coherent visual system — type scale, spacing scale, colour roles, elevation, iconography, motion — expressed as CSS custom properties + thin component classes (keep that model; **no new heavy UI/design dependencies without asking** — it's a project rule). Theming must still work via `data-*` attributes on `<html>`: light/dark/system, accent tints, material, button shape.
> 3. Redesigned layouts for the priority flows in order: **Today, Calendar, New/Edit reservation, Reservation detail, Settings.** ASCII wireframes or a written spec is fine at this stage.
>
> Respect every constraint in §9 (Next.js 15 App Router, TS strict, Tailwind v4, mobile-first ~390px, derived-availability calendar with a loud red conflict state, distinct channel badges, PWA + safe-area, accessible focus/contrast/reduced-motion, clean invoice print).
>
> Show me the critique and the proposed direction, and **wait for my approval before implementing.** Then rebuild it screen by screen, committing each slice.
