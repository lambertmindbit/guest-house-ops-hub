import { requireRole } from "@/lib/session";
import { listFaqs } from "@/lib/faq";
import { unscopedPrisma } from "@/lib/prisma";
import { SubHeader } from "@/components/settings/SubHeader";
import { FaqSection } from "@/components/settings/FaqSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireRole(["owner"]);
  const faqs = await listFaqs();

  // Which property these FAQs belong to. Shown on the import control: an operator
  // collecting sheets from several clients must never load one client's answers
  // into another's property.
  const property = session.propertyId
    ? await unscopedPrisma.propertySettings.findUnique({
        where: { id: session.propertyId },
        select: { name: true },
      })
    : null;

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Guest FAQ" sub="Answers the chat assistant gives guests" />
        <FaqSection
          propertyName={property?.name ?? null}
          faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category, active: f.active, media: (f.media as { photos?: string[]; mapLink?: string } | null) ?? null }))}
        />
      </div>
    </main>
  );
}
