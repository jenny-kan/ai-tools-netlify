"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Floating "back to top" button — appears after the reader scrolls one
 * viewport down, hides near the top. Space is always reserved via fixed
 * positioning, so it never causes layout shift. Respects the footer safe
 * area on iOS (bottom inset) and uses a big 44px touch target.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setVisible(window.scrollY > window.innerHeight * 0.9);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Scroll back to top"
      title="Scroll back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 size-11 rounded-full border-border bg-card/95 shadow-md backdrop-blur transition-all duration-200 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </Button>
  );
}
