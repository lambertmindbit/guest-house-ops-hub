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
          <i>Today</i><i>Calendar</i>
          <span className="fabm">+</span>
          <i>Guests</i><i>More</i>
        </div>
        <p className="help-a" style={{ marginBottom: 0 }}>
          The big <b>+</b> in the middle starts a <b>new booking</b> from anywhere. <b>More</b>
          {" "}opens Finance, Pricing, Inbox, Analytics, Conflicts, Feeds, Settings and
          Preferences. On a computer, the same list is a sidebar on the left. Tap the
          sun/moon to switch <b>dark / light</b>; open <b>Preferences</b> to change the accent
          colour and density.
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
        <Q q="Add a new room">Go to <Link href="/settings/rooms">Settings → Rooms → Add room</Link>. The calendar updates automatically.</Q>
        <Q q="Block a room for repairs">Calendar → <b>Block a room</b>, or <Link href="/settings/blocks">Settings → Blocked dates</Link>.</Q>
        <Q q="See who owes money"><Link href="/finance">Finance → Balances due</Link>.</Q>
        <Q q="Give a guest a bill">Open the booking → <b>Invoice</b> → Print / Save PDF.</Q>
        <Q q="Find a past guest"><Link href="/guests">Guests</Link> → search by name or phone.</Q>
        <Q q="Stop a problem guest re-booking">Open the guest → turn on <b>Blacklist</b> with a reason.</Q>
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
          <Step n={5} title="Save" sub="If those dates clash, it refuses and tells you — you can never double-book." last />
        </Flow>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>Check-in → check-out</p>
        <Flow>
          <Step n={1} title="Not arrived yet" sub="On the booking, tap Check in when the guest arrives." />
          <Step n={2} title="In-house" sub="Tap Check out when they leave." />
          <Step n={3} title="Checked out" sub="The room moves to Housekeeping to be cleaned. (Undo steps back one stage.)" last />
        </Flow>
      </div>

      <div className="card card--pad" style={{ marginBottom: 12 }}>
        <p className="h3" style={{ margin: "0 0 4px" }}>Payments &amp; invoice</p>
        <Flow>
          <Step n={1} title="Open the booking" sub="The payments panel shows collected vs balance due." />
          <Step n={2} title="Add payment" sub="Record an amount + how it was paid (cash / UPI / card / bank / OTA)." />
          <Step n={3} title="Invoice → Print / Save PDF" sub="Uses your property name, address and GST from Settings → Property." last />
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

      {/* Good to know */}
      <SectionLabel>Good to know</SectionLabel>
      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="help-a">
          <li style={{ marginBottom: 6 }}><b>Nothing is ever double-booked</b> — the app prevents two bookings overlapping in the same room.</li>
          <li style={{ marginBottom: 6 }}><b>Availability is always live</b> — worked out from your bookings and blocks, never a number that can drift.</li>
          <li style={{ marginBottom: 6 }}><b>Pricing is only a suggestion</b> — it never changes prices on the OTAs by itself.</li>
          <li style={{ marginBottom: 6 }}><b>Cancelled bookings free their dates</b> immediately for re-booking.</li>
          <li><b>Changes save instantly</b> and show on every device.</li>
        </ul>
      </div>

      <div className="banner banner--good" style={{ marginBottom: 8 }}>
        <Icon name="checkCircle" size={18} />
        <span>Stuck on something specific? The full step-by-step guide lives in <b>docs/USER-GUIDE.html</b> — ask whoever set up the app to open it for you.</span>
      </div>
    </main>
  );
}
