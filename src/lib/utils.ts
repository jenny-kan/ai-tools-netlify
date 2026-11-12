import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Serialize an object for a `<script type="application/ld+json">` block.
 *
 * JSON.stringify alone is NOT safe in a script context: it does not escape
 * `<`, so a value containing `</script><script>…` breaks out of the block and
 * injects live markup (stored XSS via blogger-controlled titles/tags/names).
 * Escape `<` (and the JSON-hostile line separators) and the output is inert.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
