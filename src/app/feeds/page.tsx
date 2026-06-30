import { redirect } from "next/navigation";

// iCal feeds moved under Property setup so it behaves like the other settings
// sub-pages (master/detail rail on desktop, back-chevron on phone). Keep this
// path working for any old links/bookmarks.
export default function FeedsRedirect() {
  redirect("/settings/feeds");
}
