"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type AppView = "home" | "tool" | "admin" | "contact" | "blog" | "blogpost" | "donate" | "blogger";

/** Blogger auth screen: sign-in, application, forgot- or reset-password. */
export type BloggerMode = "login" | "signup" | "forgot" | "reset";

export interface RouteState {
  view: AppView;
  toolSlug: string | null;
  postSlug: string | null;
  /** Blogger auth mode: login (default), signup, forgot or reset. */
  mode: BloggerMode;
  /** Reset token from the emailed link (only set in reset mode). */
  resetToken: string | null;
  q: string;
  cat: string;
  price: string;
  trial: boolean;
}

export const DEFAULT_ROUTE: RouteState = {
  view: "home",
  toolSlug: null,
  postSlug: null,
  mode: "login",
  resetToken: null,
  q: "",
  cat: "all",
  price: "all",
  trial: false,
};

export interface NavigateOptions {
  /** Update the URL without adding a history entry (used for search-as-you-type). */
  replace?: boolean;
  /** Scroll to top after navigating (used for view changes). */
  scroll?: boolean;
}

export type AppNavigate = (patch: Partial<RouteState>, options?: NavigateOptions) => void;

function parseSearch(search: string): RouteState {
  const p = new URLSearchParams(search);
  const rawView = p.get("view");
  const post = p.get("post");
  const rawMode = p.get("mode");
  const mode: BloggerMode =
    rawMode === "signup" || rawMode === "forgot" || rawMode === "reset" ? rawMode : "login";
  const view: AppView =
    rawView === "admin"
      ? "admin"
      : rawView === "contact"
        ? "contact"
        : rawView === "blog"
          ? "blog"
          : rawView === "blogpost" || (rawView === null && post)
            ? "blogpost"
            : rawView === "donate"
              ? "donate"
              : rawView === "blogger"
                ? "blogger"
                : p.get("tool")
                  ? "tool"
                  : "home";
  return {
    view,
    toolSlug: p.get("tool"),
    postSlug: post,
    mode,
    resetToken: p.get("token"),
    q: p.get("q") ?? "",
    cat: p.get("cat") ?? "all",
    price: p.get("price") ?? "all",
    trial: p.get("trial") === "1",
  };
}

const ROUTE_EVENT = "atf:route";

/** Subscribe to URL changes: real history navigation + our own route events. */
function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  window.addEventListener(ROUTE_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(ROUTE_EVENT, callback);
  };
}

const getSnapshot = (): string => window.location.search;
const getServerSnapshot = (): string => "";

/**
 * Lightweight client-side router that keeps all app state in URL params,
 * so search, filters, tool pages, blog posts and the admin view are shareable
 * and the browser back button works — while everything stays on the single
 * `/` route. The URL is treated as an external store.
 */
export function useAppRoute() {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const route = useMemo(() => parseSearch(search), [search]);

  const navigate = useCallback<AppNavigate>((patch, options = {}) => {
    const { replace = false, scroll = false } = options;
    const current = parseSearch(window.location.search);
    const next: RouteState = { ...current, ...patch };

    if (next.view !== "tool") next.toolSlug = null;
    if (next.view === "tool" && !next.toolSlug) next.view = "home";
    if (next.view !== "blogpost") next.postSlug = null;
    if (next.view === "blogpost" && !next.postSlug) next.view = "blog";

    if (next.view !== "blogger") {
      // Leaving the auth screens resets the auth mode and drops the token.
      next.mode = "login";
      next.resetToken = null;
    } else if (!patch.mode) {
      // Header/footer links arrive without an explicit mode — keep the
      // user's chosen auth screen (including a reset link they opened).
      next.mode = current.mode;
      next.resetToken = current.resetToken;
    } else if (patch.mode !== "reset") {
      next.resetToken = null;
    }
    // A reset screen without a token is meaningless — send it to "forgot".
    if (next.mode === "reset" && !next.resetToken) next.mode = "forgot";

    if (next.view === "admin" || next.view === "contact" || next.view === "donate" || next.view === "blogger" || next.view === "blog" || next.view === "blogpost") {
      next.q = "";
      next.cat = "all";
      next.price = "all";
      next.trial = false;
    }

    const p = new URLSearchParams();
    if (next.view === "admin" || next.view === "contact" || next.view === "blog" || next.view === "donate" || next.view === "blogger") {
      p.set("view", next.view);
    } else if (next.view === "blogpost") {
      p.set("post", next.postSlug!);
    } else {
      if (next.view === "tool" && next.toolSlug) p.set("tool", next.toolSlug);
      if (next.q) p.set("q", next.q);
      if (next.cat !== "all") p.set("cat", next.cat);
      if (next.price !== "all") p.set("price", next.price);
      if (next.trial) p.set("trial", "1");
    }
    if (next.view === "blogger" && next.mode !== "login") p.set("mode", next.mode);
    if (next.view === "blogger" && next.mode === "reset" && next.resetToken) {
      p.set("token", next.resetToken);
    }

    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (replace) window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);

    // history.pushState/replaceState fire no events — notify subscribers.
    window.dispatchEvent(new Event(ROUTE_EVENT));

    if (scroll) window.scrollTo({ top: 0 });
  }, []);

  return { route, navigate };
}
