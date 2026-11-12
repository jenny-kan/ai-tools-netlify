"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Copy link" share button — copies the current browser URL (the app keeps
 * all state in URL params, so the link reproduces the exact view). Falls
 * back to a hidden textarea when the Clipboard API is unavailable (e.g.
 * insecure contexts), so it works everywhere.
 */
export function CopyLinkButton({
  label = "Copy link",
  className,
  variant = "outline",
}: {
  label?: string;
  className?: string;
  variant?: "outline" | "ghost" | "secondary" | "default" | "destructive" | "link";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Legacy fallback for non-secure contexts.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Link copied — share it anywhere");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy the address from the address bar instead.");
    }
  };

  return (
    <Button type="button" variant={variant} size="sm" onClick={() => void copy()} className={cn("h-8", className)}>
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <Link2 className="size-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
