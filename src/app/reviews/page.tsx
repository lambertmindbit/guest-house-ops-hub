import { listReviews, reviewSummary } from "@/lib/reviews";
import { PageHead } from "@/components/ui";
import { ReviewsBoard } from "@/components/ReviewsBoard";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requireModule("reviews");
  const reviews = await listReviews();
  const summary = reviewSummary(reviews.map((r) => ({ status: r.status, rating: r.rating })));

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Reviews" sub="Track review requests and draft responses." />
        <ReviewsBoard
          reviews={reviews.map((r) => ({ id: r.id, channel: r.channel, status: r.status, rating: r.rating, responseDraft: r.responseDraft, link: r.link }))}
          summary={summary}
        />
      </div>
    </main>
  );
}
