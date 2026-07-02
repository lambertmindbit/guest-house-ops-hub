import type { ReactNode } from "react";
import Link from "next/link";
import { PageHead, SectionLabel, Icon } from "@/components/ui";

export const metadata = { title: "Help · Ops Hub" };

// In-app help: friendly, task-focused, mobile-first. Pure content (no DB), styled
// with the design system. The exhaustive printable guide lives in
// docs/USER-GUIDE.html; this is the at-your-fingertips version.

function Step({ n, title, sub, last }: { n: number; title: ReactNode; sub?: string; last?: boolean }) {
  return (
    <>
      <div className="flow__step">
        <span className="flow__n">{n}</span>
        <span className="flow__t"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      </div>
      {!last && <div className="flow__arrow">↓</div>}
    </>
  );
}

function Flow({ children }: { children: ReactNode }) {
  return <div className="flow">{children}</div>;
}

function Q({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <p className="help-q">{q}</p>
      <p className="help-a">{children}</p>
    </div>
  );
}

export default function HelpPage() {
  return (
    <main className="app-main">
      <PageHead title="Help" sub="How to run the property, screen by screen." />

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <p className="help-a" style={{ margin: 0 }}>
          This app is your single place for <b>bookings, the calendar, guests, housekeeping,
          pricing and money</b>. Everything below is how to do the common things. Tap any
          screen name to jump there.
        </p>
      </div>

      {/* Finding your way */}
      <SectionLabel>Finding your way around</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <p className="help-a" style={{ marginTop: 0 }}>On a phone, the bar at the bottom is your main menu:</p>
        <div className="navmock">
          <i>Today</i><i>Calendar</i><i>Bookings</i>
          <span className="fabm">+</span>
          <i>More</i>
        </div>
        <p className="help-a" style={{ marginBottom: 0 }}>
          The big <b>+</b> starts a <b>new booking</b> from anywhere. <b>More</b>
          {" "}opens everything else — Guests, Housekeeping, Complaints, Staff, Needs you;
          the <b>Facilities</b> tools (Maintenance, Inventory, Vendors, Transport,
          {" "}<b>Tours</b>); Finance, Pricing, Analytics; the <b>Community</b> screens
          (Directory, Referrals, Trusted lists); Inbox, Messages, Escalations, Reviews;
          and Property setup and Help. On a computer, the same list is a sidebar on the
          left. Tap the sun/moon to switch <b>dark / light</b>; open <b>Preferences</b>
          {" "}(the gear, top-right) to change the accent colour, density, or — if you run
          more than one property — <b>switch property</b>.
        </p>
      </div>

      {/* How the day flows */}
      <SectionLabel>A typical day</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <Flow>
          <Step n={1} title={<>Open <Link href="/">Today</Link></>} sub="See arrivals, departures, who's in-house, and anything needing attention." />
          <Step n={2} title="Check guests in" sub="As they arrive, open the booking → Check in." />
          <Step n={3} title="Check guests out" sub="As they leave, open the booking → Check out." />
          <Step n={4} title={<>Clean rooms in <Link href="/housekeeping">Housekeeping</Link></>} sub="Checked-out rooms appear here to clean." />
          <Step n={5} title="Record payments" sub="Log money received on each booking." last />
        </Flow>
      </div>

      {/* Common tasks */}
      <SectionLabel>Common tasks</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <div style={{ paddingTop: 2 }} />
        <Q q="Take a new booking">Tap the <b>+</b> button (or <Link href="/reservations/new">New booking</Link>).</Q>
        <Q q="Find any booking fast"><Link href="/reservations">Bookings</Link> → search by name, phone, room or channel, or filter by timeline (upcoming, in-house, past, cancelled).</Q>
        <Q q="Add a new room">Go to <Link href="/settings/rooms">Settings → Rooms → Add room</Link>. The calendar updates automatically.</Q>
        <Q q="Block a room for repairs">Calendar → <b>Block a room</b>, or <Link href="/settings/blocks">Settings → Blocked dates</Link>.</Q>
        <Q q="See who owes money">The <Link href="/">Today</Link> screen shows a <b>Pending payments</b> card (owners only) with the total still due; <Link href="/finance">Finance → Balances due</Link> lists each one.</Q>
        <Q q="Arrange a tour or activity"><Link href="/tours">Tours</Link> → add a partner/guide (with commission), list the tours you offer, and book one for a guest.</Q>
        <Q q="Give a guest a bill">Open the booking → <b>Invoice</b> → Print / Save PDF.</Q>
        <Q q="Find a past guest"><Link href="/guests">Guests</Link> → search by name or phone.</Q>
        <Q q="Stop a problem guest re-booking">Open the guest → turn on <b>Blacklist</b> with a reason.</Q>
        <Q q="Flag a scam phone number"><Link href="/settings/flagged-numbers">Settings → Scam numbers</Link> → add it with a reason. You&rsquo;ll be warned next time it&rsquo;s used on a booking.</Q>
        <Q q="Record a foreign guest's passport / visa (Form C)">Open the guest → the <b>Foreign-national details</b> section.</Q>
      </div>

      {/* Key workflows */}
      <SectionLabel>Step-by-step workflows</SectionLabel>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>Taking a booking</p>
        <Flow>
          <Step n={1} title="Tap +" sub="Opens the new-booking form." />
          <Step n={2} title="Enter guest name & phone" sub="If the phone matches an existing guest, their record is reused." />
          <Step n={3} title="Pick channel, room and dates" sub="Already-booked rooms are greyed out for those dates." />
          <Step n={4} title="Check the amount" sub="If pricing rules are set, a suggested price pre-fills — tap Use or type your own." />
          <Step n={5} title="Confirm the ID note" sub="Tick the confirmation that a valid ID will be collected at check-in." />
          <Step n={6} title="Save" sub="If those dates clash, it refuses and tells you — you can never double-book." last />
        </Flow>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>Check-in → check-out</p>
        <Flow>
          <Step n={1} title="Not arrived yet" sub="On the booking, tap Check in when the guest arrives." />
          <Step n={2} title="Record their ID first" sub="Check-in is blocked until the guest's government ID is on file (foreign guests need the C-Form / passport). If it's missing, tap 'Record ID' on the booking to add it." />
          <Step n={3} title="In-house" sub="Tap Check out when they leave." />
          <Step n={4} title="Checked out" sub="The room moves to Housekeeping to be cleaned. (Undo steps back one stage.)" last />
        </Flow>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>Payments &amp; invoice</p>
        <Flow>
          <Step n={1} title="Open the booking" sub="The payments panel shows collected vs balance due (and advance status, if an advance is set)." />
          <Step n={2} title="Add payment" sub="Record an amount + how it was paid. Tick 'advance deposit' if it's the advance." />
          <Step n={3} title="Verify UPI / bank" sub="For UPI or bank, enter the UTR/reference and tick the checklist — guards against fake-payment scams." />
          <Step n={4} title="Invoice → Print / Save PDF" sub="Uses your property name, address and GST from Settings → Property." last />
        </Flow>
      </div>

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>OTA emails (Inbox)</p>
        <Flow>
          <Step n={1} title={<>Paste the email into <Link href="/inbox">Inbox</Link></>} sub="Or it arrives automatically if your tech setup is wired up." />
          <Step n={2} title="Review the details" sub="It fills what it can; correct anything and pick the room." />
          <Step n={3} title="Create booking" sub="Added to the calendar and conflict-checked like any booking. Nothing is ever auto-booked." last />
        </Flow>
      </div>

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>AI assistant (Escalations &amp; Messages)</p>
        <p className="help-a" style={{ marginTop: 0 }}>
          Two screens that light up once your tech team connects the <b>AI assistant</b>
          {" "}(it can chat with guests, coordinate cabs, and help at the front desk). Until
          then they sit empty.
        </p>
        <Flow>
          <Step n={1} title={<><Link href="/escalations">Escalations</Link> — your to-do queue</>} sub="When the assistant can't decide something (special request, complaint, an action needing your approval), it files it here instead of acting. Open one, act, and mark it resolved." />
          <Step n={2} title={<><Link href="/messages">Messages</Link> — the outbox</>} sub="A log of every message sent or queued to guests (WhatsApp / SMS / email), so you have a record of what went out." last />
        </Flow>
        <p className="help-a" style={{ marginBottom: 0 }}>
          The app already <b>drafts guest messages automatically</b> — a booking
          confirmation, a pre-arrival note with directions the day before check-in, and
          payment reminders for balances still due. Today they&rsquo;re written to the
          {" "}<Link href="/messages">Messages</Link> log (a record, not yet sent); once a
          WhatsApp provider is connected they&rsquo;ll go out for real, with no change to
          how you work.
        </p>
      </div>

      {/* Good to know */}
      <SectionLabel>Good to know</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="help-a">
          <li style={{ marginBottom: 6 }}><b>Nothing is ever double-booked</b> — the app prevents two bookings overlapping in the same room.</li>
          <li style={{ marginBottom: 6 }}><b>Availability is always live</b> — worked out from your bookings and blocks, never a number that can drift.</li>
          <li style={{ marginBottom: 6 }}><b>Pricing is only a suggestion</b> — it never changes prices on the OTAs by itself.</li>
          <li style={{ marginBottom: 6 }}><b>Cancelled bookings free their dates</b> immediately for re-booking.</li>
          <li style={{ marginBottom: 6 }}><b>Changes save instantly</b> and show on every device.</li>
          <li style={{ marginBottom: 6 }}><b>Patchy signal is OK</b> — if you lose connection, changes you make are saved and sync automatically when you&rsquo;re back online. If a booking clashed while you were offline, the app tells you so you can sort it.</li>
          <li style={{ marginBottom: 6 }}><b>Guest IDs auto-expire</b> — set a retention period in <Link href="/settings/property">Settings → Property</Link> and scanned ID documents older than that are deleted for you (privacy).</li>
          <li><b>The ID rule is yours to set</b> — in <Link href="/settings/property">Settings → Property</Link>, choose whether check-in is <b>blocked</b> without an ID, only <b>warns</b>, or is <b>off</b>; and optionally require an ID number to take a booking (for walk-in-only properties).</li>
        </ul>
      </div>

      <div className="banner banner--good" style={{ marginBottom: 8 }}>
        <Icon name="checkCircle" size={18} />
        <span>Stuck on something specific? The full step-by-step guide lives in <b>docs/USER-GUIDE.html</b> — ask whoever set up the app to open it for you.</span>
      </div>
    </main>
  );
}
