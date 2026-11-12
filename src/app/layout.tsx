import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** themeColor follows the OS light/dark chrome (PWA + mobile address bar). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description =
  "A hand-checked directory of free and paid AI tools. Describe what you want to do — like “transcribe a meeting” — and instantly find AI tools that do it, with free-plan limits, free trials, and pricing checked dates. Plus practical guides on using ChatGPT, Claude, Midjourney and more.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AI Tool Finder — Find the right AI tool for any task",
    template: "%s · AI Tool Finder",
  },
  description,
  keywords: [
    "AI tools",
    "AI directory",
    "free AI tools",
    "AI search",
    "freemium",
    "AI catalog",
    "ChatGPT guide",
    "Claude AI",
    "Midjourney",
    "AI blog",
    "how to use AI tools",
  ],
  applicationName: "AI Tool Finder",
  authors: [{ name: "AI Tool Finder editors" }],
  creator: "AI Tool Finder",
  // NOTE: no blanket canonical here — the app serves many logical pages
  // (tools, posts, views) from the "/" route via URL params, and a site-wide
  // canonical:"/" would tell crawlers every sitemap URL is a duplicate of the
  // home page.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "AI Tool Finder",
    title: "AI Tool Finder — Find the right AI tool for any task",
    description:
      "Describe a task — like “transcribe a meeting” — and instantly find AI tools that do it, with free-plan details and pricing. Plus guides on using AI tools effectively.",
    url: siteUrl,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1344,
        height: 768,
        alt: "AI Tool Finder — a hand-checked directory of free and paid AI tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Tool Finder — Find the right AI tool for any task",
    description:
      "Describe a task and instantly find AI tools that do it — free plans, trials and pricing checked by editors.",
    images: ["/og-image.png"],
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
