import { requireRole } from "@/lib/session";
import { listFaqs } from "@/lib/faq";
import { SubHeader } from "@/components/settings/SubHeader";
import { FaqSection } from "@/components/settings/FaqSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]);
  const faqs = await listFaqs();

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Guest FAQ" sub="Answers the chat assistant gives guests" />
        <FaqSection faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category, active: f.active, media: (f.media as { photos?: string[]; mapLink?: string } | null) ?? null }))} />
      </div>
    </main>
  );
}
