import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Serverless hosts set these at build time: Vercel (VERCEL=1) and Netlify
// (NETLIFY=true). Both deploy from the standard .next output — standalone
// tracing is wasted work there, and Netlify's runtime prefers it off.
const isServerlessHost = Boolean(process.env.VERCEL || process.env.NETLIFY);

/**
 * Security headers (OWASP 2025 A02 — security misconfiguration).
 *  - CSP: dev keeps 'unsafe-eval' (Turbopack HMR); production drops it.
 *    'unsafe-inline' for scripts stays until a nonce-based CSP is adopted
 *    (Next.js inline hydration scripts need it) — see SECURITY.md.
 *  - object-src / frame-ancestors / base-uri are fully locked down.
 *  - HSTS (prod only) with preload so browsers enforce HTTPS before the first
 *    visit once the domain is submitted to hstspreload.org.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Production drops 'unsafe-eval' — nothing legit needs it in a build.
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Dev-only: the Next 16 dev server validates the HMR WebSocket's Origin
  // and REJECTS anything that isn't "localhost" by default — including
  // 127.0.0.1 and the sandbox/preview proxy (*.space-z.ai). A rejected HMR
  // socket makes dev hydration stall SILENTLY (SSR HTML with no event
  // handlers). Test dev builds on http://localhost:3000, and keep the
  // proxy origin allowed here. No effect on production builds.
  allowedDevOrigins: ["*.space-z.ai"],
  // Self-hosting friendly (Docker/bare-metal/launchd use it). Skipped on the
  // serverless hosts (see isServerlessHost above) — Vercel ignores it anyway,
  // and Netlify's Next.js runtime builds functions from the regular output.
  output: isServerlessHost ? undefined : "standalone",
  // Prisma 7 driver adapters: keep the pg driver out of the server bundle
  // (required for standalone builds).
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    // Type errors FAIL the build — the codebase is kept type-clean on purpose.
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
