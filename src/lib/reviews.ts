import { prisma } from "@/lib/prisma";
import type { ReviewStatus } from "@prisma/client";

export async function listReviews() {
  return prisma.reviewRequest.findMany({ orderBy: { createdAt: "desc" } });
}
export async function createReview(data: { channel?: string; link?: string | null }) {
  return prisma.reviewRequest.create({ data: { channel: data.channel ?? "Google", link: data.link ?? null } });
}
export async function updateReview(id: string, patch: { status?: ReviewStatus; rating?: number | null; responseDraft?: string | null; link?: string | null }) {
  const existing = await prisma.reviewRequest.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.reviewRequest.update({ where: { id }, data: patch });
}

// ── Pure summary (testable) ──────────────────────────────────────────────────
export type ReviewForSummary = { status: ReviewStatus; rating: number | null };
export function reviewSummary(reviews: ReviewForSummary[]): {
  total: number; received: number; responded: number; avgRating: number | null; responseRate: number;
} {
  const total = reviews.length;
  const received = reviews.filter((r) => r.status === "received" || r.status === "responded").length;
  const responded = reviews.filter((r) => r.status === "responded").length;
  const rated = reviews.filter((r) => r.rating != null);
  const avgRating = rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
  const responseRate = received ? Math.round((responded / received) * 100) : 0;
  return { total, received, responded, avgRating, responseRate };
}
