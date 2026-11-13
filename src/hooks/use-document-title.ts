"use client";

import { useEffect } from "react";

/**
 * Keep document.title in sync with the current view (SEO + history entries +
 * screen-reader users navigating by window title). The base template mirrors
 * the root layout metadata so titles look consistent everywhere.
 *
 * Usage: useDocumentTitle("ChatGPT")            → "ChatGPT · ai tools central"
 *        useDocumentTitle("ChatGPT", false)     → "ChatGPT" (exact)
 */
export function useDocumentTitle(title: string | null, suffix = true) {
  useEffect(() => {
    document.title = title ? (suffix ? `${title} · ai tools central` : title) : "ai tools central — Find the right AI tool for any task";
  }, [title, suffix]);
}
