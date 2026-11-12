"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { DataProvider } from "@/components/app/data-context";
import { useAppRoute } from "@/components/app/use-app-route";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { HomeView } from "@/components/app/home-view";
import { ToolDetailView } from "@/components/app/tool-detail-view";
import { ContactView } from "@/components/app/contact-view";
import { BlogListView } from "@/components/app/blog/blog-list-view";
import { BlogPostView } from "@/components/app/blog/blog-post-view";
import { DonateView } from "@/components/app/donate-view";
import { ScrollToTop } from "@/components/app/scroll-to-top";
import { trackPageView } from "@/lib/api";

// The admin dashboard and blogger studio are the two heaviest bundles
// (forms, wizards, charts). Most visitors never open them, so they're
// lazy-loaded — the public catalog gets interactive sooner.
const AdminView = dynamic(
  () => import("@/components/app/admin/admin-view").then((m) => m.AdminView),
  {
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading admin dashboard">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);
const BloggerView = dynamic(
  () => import("@/components/app/blog/blogger-view").then((m) => m.BloggerView),
  {
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading blogger studio">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);

export default function Page() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

/**
 * All views — browse, tool detail, blog, blogger studio, donate, contact and
 * the admin dashboard — live on the single `/` route, driven by URL params
 * (?q=, ?cat=, ?tool=, ?view=blog, ?view=contact, ?view=admin, …) so searches
 * and listings are shareable and the back button works.
 */
function AppShell() {
  const { route, navigate } = useAppRoute();

  // Privacy-friendly analytics beacon: fires once per meaningful view change
  // (view/tool/post/category/pricing — not every keystroke in the search box).
  useEffect(() => {
    if (route.view === "admin") return; // don't skew stats with admin traffic

    let sessionId = "anon-session";
    try {
      let sid = localStorage.getItem("atf_sid");
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("atf_sid", sid);
      }
      sessionId = sid;
    } catch {
      // storage unavailable — fall back to the anonymous bucket
    }

    const p = new URLSearchParams();
    if (route.view === "tool" && route.toolSlug) p.set("tool", route.toolSlug);
    if (route.view === "blogpost" && route.postSlug) p.set("post", route.postSlug);
    if (route.view !== "home" && route.view !== "tool" && route.view !== "blogpost") p.set("view", route.view);
    if (route.cat !== "all") p.set("cat", route.cat);
    if (route.price !== "all") p.set("price", route.price);
    if (route.trial) p.set("trial", "1");
    const qs = p.toString();

    trackPageView({
      path: `/${qs ? `?${qs}` : ""}`,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      sessionId,
      toolSlug: route.view === "tool" ? (route.toolSlug ?? "") : "",
    });
  }, [route.view, route.toolSlug, route.postSlug, route.cat, route.price, route.trial]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Keyboard users can jump straight past the header to the content. */}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Header route={route} navigate={navigate} />
      <main id="main-content" className="flex-1">
        {route.view === "home" && <HomeView route={route} navigate={navigate} />}
        {route.view === "tool" && route.toolSlug && (
          <ToolDetailView key={route.toolSlug} slug={route.toolSlug} navigate={navigate} />
        )}
        {route.view === "blog" && <BlogListView navigate={navigate} />}
        {route.view === "blogpost" && route.postSlug && (
          <BlogPostView key={route.postSlug} slug={route.postSlug} navigate={navigate} />
        )}
        {route.view === "blogger" && (
          <BloggerView navigate={navigate} initialMode={route.mode} resetToken={route.resetToken} />
        )}
        {route.view === "donate" && <DonateView navigate={navigate} />}
        {route.view === "contact" && <ContactView navigate={navigate} />}
        {route.view === "admin" && <AdminView />}
      </main>
      <Footer navigate={navigate} />
      <ScrollToTop />
    </div>
  );
}
