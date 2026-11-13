import type { MetadataRoute } from "next";

/**
 * PWA web app manifest — makes the site installable ("Add to Home Screen")
 * and gives Android/Google a proper name + icons. Uses the existing SVG logo
 * (Next.js serves /logo.svg with the correct MIME type).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ai tools central — Find the right AI tool for any task",
    short_name: "ai tools central",
    description:
      "A hand-checked directory of free and paid AI tools. Describe a task and instantly find AI tools that do it, with free-plan limits, free trials and pricing.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    categories: ["productivity", "utilities", "technology"],
  };
}
