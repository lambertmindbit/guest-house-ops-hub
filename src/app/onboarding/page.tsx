import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentPropertySettings } from "@/lib/property-settings";
import { bookableReadiness } from "@/lib/fleet";
import { getT } from "@/lib/i18n/server";
import { PageHead, Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

// First-run onboarding wizard (GAP-18/US-702). A live checklist that walks a new
// owner from an empty deployment to a bookable state, reusing the existing setup
// forms rather than duplicating them. Each step reflects real data and turns green
// on its own — so the owner always knows exactly what's left and when they're done.
export default async function OnboardingPage() {
  const [property, roomTypes, rooms, channels, staff, t] = await Promise.all([
    currentPropertySettings(),
    prisma.roomType.count(),
    prisma.room.count(),
    prisma.channel.count(),
    prisma.staff.count(),
    getT(),
  ]);

  const { steps, bookable, requiredRemaining } = bookableReadiness({
    propertyNamed: !!property && property.name !== "My Guest House",
    roomTypes,
    rooms,
    channels,
    staff,
  });

  // Each step's label/hint is translated from its key; keys mirror the step keys.
  const stepLabel = (key: string) => t(`onboarding.step.${key}`);
  const stepHint = (key: string) => t(`onboarding.step.${key}.hint`);

  return (
    <main className="app-main" style={{ maxWidth: 640 }}>
      <div className="entrance">
        <PageHead title={t("onboarding.title")} sub={t("onboarding.subtitle")} />

        {bookable ? (
          <div className="banner banner--good" style={{ cursor: "default", marginBottom: 16 }}>
            <span className="banner__icon"><Icon name="check" size={18} /></span>
            <span style={{ flex: 1 }}>
              <b>{t("onboarding.ready")}</b> {t("onboarding.readyHint")}
            </span>
          </div>
        ) : (
          <div className="banner banner--warn" style={{ cursor: "default", marginBottom: 16 }}>
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span style={{ flex: 1 }}>
              <b>{t("onboarding.stepsToGo", { n: requiredRemaining })}</b> {t("onboarding.stepsToGoHint")}
            </span>
          </div>
        )}

        <div className="col" style={{ gap: 10 }}>
          {steps.map((s, i) => (
            <Link
              key={s.key}
              href={s.href}
              className="card"
              style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 13, opacity: s.done ? 0.72 : 1 }}
            >
              <span
                className={`badge ${s.done ? "badge--good" : s.required ? "badge--warn" : "badge--neutral"}`}
                style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", flex: "none", padding: 0 }}
              >
                {s.done ? <Icon name="check" size={15} /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {stepLabel(s.key)}
                  {!s.required && <span className="muted" style={{ fontWeight: 400 }}> · {t("onboarding.optional")}</span>}
                </div>
                <div className="muted" style={{ fontSize: "var(--fs-small)", marginTop: 2 }}>{stepHint(s.key)}</div>
              </div>
              <Icon name="chevronR" size={16} />
            </Link>
          ))}
        </div>

        {bookable && (
          <Link href="/calendar" className="btn btn--primary btn--block" style={{ marginTop: 18 }}>
            <Icon name="calendar" size={16} /> {t("onboarding.goToCalendar")}
          </Link>
        )}
      </div>
    </main>
  );
}
