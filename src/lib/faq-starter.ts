import starter from "./faq-starter.json";

// A comprehensive pack of the questions travellers commonly ask a homestay/hotel —
// pool, AC, hot water, meals, location, transport, payment, policies, safety, etc.
// Shared by the seed (new deployments) and the in-app "Load starter pack" action
// (existing property). Answers are sensible DRAFTS: the pack loads as INACTIVE, so
// the owner reviews/edits each and switches on only the ones true for their place.
export type StarterFaq = { question: string; answer: string; category: string };

export const STARTER_FAQS: StarterFaq[] = starter as StarterFaq[];
