/**
 * Seed: demo blogger + blog posts + donations + page views + audit entries.
 *
 * Portable: uses Prisma Client only (no raw SQL), so it runs identically
 * against any PostgreSQL host (Neon/Supabase/local).
 * Idempotent: skips rows that already exist.
 *
 * Run with:  pnpm db:seed   (or: bunx tsx scripts/seed-blog.ts)
 */
import { randomBytes, scryptSync } from "node:crypto";
import "dotenv/config"; // Prisma 7 no longer auto-loads .env
import { db } from "../src/lib/db";

function hashPassword(password: string): string {
  const N = 16384, r = 8, p = 1, KEY_LEN = 64;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

const daysAgo = (d: number, jitterHours = 0) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000 - jitterHours * 60 * 60 * 1000);

async function main() {
  // ------------------------------------------------------------------ bloggers
  const bloggers = [
    {
      email: "demo@aitoolfinder.dev",
      name: "Maya Chen",
      password: "Blogger-Demo-2025-Pass-Abc123", // 30 chars — meets the 20+ policy
      bio: "Productivity nerd and prompt engineer. I test AI tools so you don't have to.",
      status: "APPROVED",
      applicationReason: "I write practical AI workflows for makers and want to share tested guides here.",
      writingSample: "Last month I rebuilt my entire content workflow around three AI tools. The result: drafts in half the time, and every piece still sounds like me. Here is exactly how the pipeline works, step by step.",
      appliedAt: daysAgo(20),
      decidedAt: daysAgo(19),
    },
    {
      email: "jordan.rivers@example.com",
      name: "Jordan Rivers",
      password: "Jordan-Rivers-2025-Blog-Pass-X9y8",
      bio: "Indie hacker exploring no-code + AI automation.",
      status: "PENDING",
      applicationReason: "I build small products with AI automation and would love to document the workflows publicly.",
      writingSample: "Every time a new AI tool launches, I spend a weekend rebuilding one of my automations with it. Some tools cut my costs in half; others were all hype. I write honest, hands-on comparisons with real numbers and screenshots.",
      appliedAt: daysAgo(1),
      decidedAt: null,
    },
    {
      email: "sam.okafor@example.com",
      name: "Sam Okafor",
      password: "Sam-Okafor-2025-Blog-Pass-Qw7z",
      bio: "Data analyst by day, AI tinkerer by night.",
      status: "PENDING",
      applicationReason: "I teach a small data science study group and want to publish our AI tool notes for everyone.",
      writingSample: "My study group tested five AI note-taking tools over six weeks. The surprising result: the best tool was not the most expensive one, but the one that got out of the way. This is the full comparison, with the exact prompts we used to test them.",
      appliedAt: daysAgo(2),
      decidedAt: null,
    },
  ];

  for (const b of bloggers) {
    const exists = await db.blogger.findUnique({ where: { email: b.email } });
    if (exists) {
      console.log("  = blogger exists:", b.email);
      continue;
    }
    await db.blogger.create({
      data: {
        email: b.email,
        name: b.name,
        passwordHash: hashPassword(b.password),
        bio: b.bio,
        status: b.status,
        applicationReason: b.applicationReason,
        writingSample: b.writingSample,
        appliedAt: b.appliedAt,
        decidedAt: b.decidedAt,
      },
    });
    console.log("  + blogger:", b.name, `(${b.status})`);
  }

  const maya = await db.blogger.findUniqueOrThrow({ where: { email: "demo@aitoolfinder.dev" } });

  // ---------------------------------------------------------------- blog posts
  const posts = [
    {
      slug: "chatgpt-prompts-that-actually-save-time",
      title: "10 ChatGPT Prompts That Actually Save You Time",
      excerpt: "Most prompt lists are filler. These ten are the ones I use every week — with the exact wording that works.",
      tags: "chatgpt,prompting,productivity",
      status: "PUBLISHED",
      publishedAt: daysAgo(6),
      content: `Everyone has a "100 best prompts" list. Almost none survive contact with a real workday. After a year of using ChatGPT daily for writing, planning and research, ten prompts have genuinely stuck — because each one replaces a task I used to do manually.

## 1. The meeting-prep prompt

Before any meeting, paste the attendee list and the goal, then ask: "You are my chief of staff. Prepare a one-page brief: attendees' likely priorities, three questions I should ask, and two risks to flag." The brief takes 20 seconds to read and consistently makes me look like the most prepared person in the room.

## 2. The ruthless editor

"Cut this text by 30% without losing meaning. Mark every change you made." The key is the second sentence — seeing the cuts teaches you your own bad habits. Mine were hedging words and redundant intros.

## 3. The decision matrix

When choosing between options, ask ChatGPT to build a weighted decision table, then argue *against* the winner. The counter-argument surfaces the risks you were too excited to notice.

## 4–7. The research quartet

Four prompts that chain well: define the landscape, list the trade-offs, steelman the opposite view, then summarize for a smart 12-year-old. The last one is unfairly effective at exposing hand-waving.

## 8. The email unblocker

"I need to say no to this request but keep the relationship warm. Three drafts: direct, warm, and formal." Pick the spine of one and edit for 60 seconds. Fifteen-minute emails become two-minute emails.

## 9. The weekly review

Every Friday: "Interview me about my week based on these notes, then summarize what to start, stop and continue." Being interviewed forces honesty that self-reviews skip.

## 10. The explainer loop

"Explain X. Now identify what a beginner would still misunderstand in your explanation. Fix it." The loop catches the gaps a single pass leaves behind.

## The meta-prompt behind all of them

Notice the pattern: every prompt gives ChatGPT a *role*, *context*, and a *format constraint*. Role tunes the vocabulary, context prevents generic answers, and format keeps the output usable. Steal that structure and write your own — the best prompt is always the one made for your actual Tuesday.`,
    },
    {
      slug: "claude-for-coding-practical-workflow",
      title: "Claude for Coding: A Practical Pair-Programming Workflow",
      excerpt: "How to use Claude as a genuine pair programmer — repo context, review loops, and when to stop asking and start reading.",
      tags: "claude,coding,workflow",
      status: "PUBLISHED",
      publishedAt: daysAgo(4),
      content: `After six months of pairing with Claude on a real codebase, the biggest lesson is counterintuitive: the bottleneck is not the model, it's the context you feed it. Here's the workflow that finally clicked.

## Start with the map, not the task

Before asking for code, I paste the project structure and the two or three most relevant files. "Here is the layout. The bug appears in X when Y. Read these files before answering." The difference in answer quality is night and day — Claude stops suggesting patterns that don't exist in the project.

## The review loop beats the generation loop

Asking for full implementations produces impressive-looking code with subtle breaks. Asking for *reviews* of my own code catches real issues. My split is roughly 70% review questions, 30% generation. "What edge cases does this function miss?" finds more bugs than "write this function."

## Commit-sized asks

Big refactors fail. The workflow that works: describe the end state, ask for a step list, then execute one step per conversation. Each step gets pasted back with the result before the next. It feels slower and is dramatically faster.

## When to stop asking

If I catch myself pasting the same error three times, that's the signal to stop and actually read the stack trace. The model is a lever, not a substitute for understanding — every answer still has to pass my own review before it lands in main.

## The checklist before merging

1. Did I understand every line I'm about to commit?
2. Did I test the failure path, not just the happy path?
3. Can I explain this diff to a teammate in two sentences?

If any answer is no, the conversation isn't done. That discipline is what makes AI pair programming feel like a superpower instead of a liability.`,
    },
    {
      slug: "free-ai-tools-worth-your-time",
      title: "Free AI Tools That Are Actually Worth Your Time",
      excerpt: "Free tiers are marketing bait — except when they're not. These seven free plans deliver real, daily-driver value.",
      tags: "free-tools,roundup,budget",
      status: "PUBLISHED",
      publishedAt: daysAgo(2),
      content: `Most "free" AI tools are demos wearing free-tier costumes: three generations, watermarks, or a credit card ambush after login. But a small group of free plans are genuinely usable every day. Here are the ones that survived a month of real work.

## The daily drivers

**Whisper** for transcription remains unbeatable at zero dollars — local, fast, and shockingly accurate on messy audio. **Google AI Studio** gives generous free access to strong Gemini models, enough for daily Q&A and light coding help. **NotebookLM** turns your own PDFs into a grounded research assistant; the free tier is the whole product.

## The specialists

**Ideogram's** free plan still renders legible text in images — the one thing most free image tools fail at. **Perplexity** offers enough free searches to replace your default search engine for research questions. **CapCut** bundles surprisingly capable AI editing tools into its free tier. And **Suno's** free credits are enough to make a birthday song that will embarrass your sibling appropriately.

## How to read a free plan like a skeptic

Before you invest time in any free tier, check three things: the *monthly* credit reset (not just the signup bonus), export rights (can you actually download the output?), and whether your data trains their models. The tool directory on this site lists free-plan limits for every entry for exactly this reason.

## The honest trade-off

Free tools cost you workflow stability — limits change, models get swapped, features move behind paywalls. My rule: free tools for exploration and low-stakes work; paid plans for anything with a deadline. The seven tools above are the rare free plans stable enough to build habits on.`,
    },
    {
      slug: "midjourney-style-guide-beginners",
      title: "Midjourney for Beginners: The Style Settings That Matter",
      excerpt: "Forget the 500-word mega-prompts. Five style settings explain 90% of the images you actually want.",
      tags: "midjourney,images,guide",
      status: "SUBMITTED",
      publishedAt: null,
      content: `Beginner guides to Midjourney love showing off paragraph-length prompts. In practice, five settings explain almost every image style you'll want — and mastering them takes an afternoon, not a month.

## The five settings

1. **Style raw** — turns down Midjourney's own aesthetic opinions. Off for pretty pictures, on for product shots and consistency.
2. **Stylize value** — how much creative license you're granting. Low numbers follow your prompt literally; high numbers make art you didn't ask for.
3. **Chaos** — variety between the four results. Zero when you know what you want, high when you want to be surprised.
4. **Aspect ratio** — the most boring and most important setting. Match the destination, not the demo.
5. **Seed** — the repeatability trick. Same seed plus same prompt plus same settings equals same image, which is how you iterate deliberately.

## A workflow that doesn't waste credits

Generate wide with chaos high, pick the one direction worth pursuing, then lock the seed and refine the prompt in small steps. Beginners burn credits refining four random directions at once; this workflow means every iteration is a decision, not a lottery ticket.

## What still needs a human

Style settings won't fix composition problems or add the one object you forgot to mention. The skill that compounds is looking at failed images and translating *why* they failed into prompt language. That's a photography eye, not a prompting trick — and it's why the best prompt engineers are just people who look carefully at pictures.`,
    },
    {
      slug: "notion-ai-vs-dedicated-tools",
      title: "Notion AI vs. Dedicated AI Tools: When the Built-In Wins",
      excerpt: "Draft: comparing embedded AI features against standalone tools for docs, search and summaries.",
      tags: "notion,productivity,draft",
      status: "DRAFT",
      publishedAt: null,
      content: `Draft notes: embedded AI (Notion, Google Docs) versus standalone tools. Thesis: embedded wins for convenience, standalone wins for control — the interesting question is where the crossover sits for different document types.`,
    },
  ];

  for (const p of posts) {
    const exists = await db.blogPost.findUnique({ where: { slug: p.slug } });
    if (exists) {
      console.log("  = post exists:", p.slug);
      continue;
    }
    await db.blogPost.create({
      data: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        tags: p.tags,
        status: p.status,
        authorId: maya.id,
        publishedAt: p.publishedAt,
      },
    });
    console.log("  + post:", p.slug, `(${p.status})`);
  }

  // ---------------------------------------------------------------- donations
  const donations = [
    { name: "Alex Voss", email: "alex@example.com", cents: 2500, msg: "The free-plan limits alone saved me hours of comparison shopping. Thank you!", status: "COMPLETED", at: daysAgo(9) },
    { name: "Priya N.", email: "", cents: 1000, msg: "Keep the rankings honest!", status: "COMPLETED", at: daysAgo(7) },
    { name: "Marcus T.", email: "marcus@example.com", cents: 5000, msg: "The ChatGPT prompts article is worth a subscription on its own.", status: "COMPLETED", at: daysAgo(3) },
    { name: "Lena K.", email: "", cents: 1000, msg: "", status: "COMPLETED", at: daysAgo(1) },
    { name: "Dev Friend", email: "", cents: 500, msg: "More Midjourney guides please", status: "PENDING", at: daysAgo(0) },
  ];

  let newDonations = 0;
  for (const d of donations) {
    const exists = await db.donation.findFirst({
      where: { donorName: d.name, amountCents: d.cents },
    });
    if (exists) continue;
    await db.donation.create({
      data: {
        donorName: d.name,
        email: d.email,
        amountCents: d.cents,
        currency: "USD",
        message: d.msg,
        status: d.status,
        provider: "demo",
        createdAt: d.at,
        updatedAt: d.at,
      },
    });
    newDonations++;
  }
  console.log("  + donations:", newDonations);

  // --------------------------------------------------------------- page views
  const viewCount = await db.pageView.count();
  if (viewCount < 50) {
    const postSlugs = ["chatgpt-prompts-that-actually-save-time", "claude-for-coding-practical-workflow", "free-ai-tools-worth-your-time"];
    const paths = [
      "/", "/", "/", "/", "/", "/", "/", "/", "/", "/",
      "/?view=blog", "/?view=blog", "/?view=blog", "/?view=blog",
      "/?view=donate", "/?view=contact",
      "/?tool=chatgpt", "/?tool=chatgpt", "/?tool=claude", "/?tool=claude", "/?tool=midjourney", "/?tool=perplexity", "/?tool=cursor",
      "/?cat=chat", "/?cat=chat", "/?cat=images", "/?cat=images", "/?cat=coding", "/?cat=video",
      `/?post=${postSlugs[0]}`, `/?post=${postSlugs[0]}`, `/?post=${postSlugs[1]}`, `/?post=${postSlugs[2]}`,
      "/?q=transcribe", "/?price=FREE", "/?trial=1",
    ];
    const referrers = ["", "", "", "", "https://www.google.com", "https://www.google.com", "https://x.com", "https://news.ycombinator.com", "https://www.reddit.com", "https://duckduckgo.com", "https://github.com"];
    const sessions = Array.from({ length: 46 }, () => randomBytes(12).toString("hex"));
    let seeded = 0;
    // recent days get more traffic: weight day 0 highest
    for (let day = 13; day >= 0; day--) {
      const weight = 1 + (13 - day) * 0.35; // ramps up to ~5.5x
      const views = Math.round(4 * weight + Math.random() * 3);
      const rows = Array.from({ length: views }, () => {
        const path = paths[Math.floor(Math.random() * paths.length)];
        const ref = referrers[Math.floor(Math.random() * referrers.length)];
        const toolSlug = path.startsWith("/?tool=") ? path.replace("/?tool=", "") : "";
        return {
          path,
          referrer: ref,
          sessionId: sessions[Math.floor(Math.random() * sessions.length)],
          toolSlug,
          createdAt: daysAgo(day, Math.random() * 20),
        };
      });
      await db.pageView.createMany({ data: rows });
      seeded += rows.length;
    }
    console.log("  + page views:", seeded);
  } else {
    console.log("  = page views already seeded");
  }

  // ------------------------------------------------------------------- audit
  const auditCount = await db.auditLog.count();
  if (auditCount === 0) {
    const entries: { action: string; actorType: string; actorId: string; details: string; ip: string; at: Date }[] = [
      { action: "admin.login.success", actorType: "admin", actorId: "", details: "Signed in from the dashboard", ip: "127.0.0.1", at: daysAgo(1) },
      { action: "blogger.signup.created", actorType: "visitor", actorId: "", details: "Maya Chen <demo@aitoolfinder.dev>", ip: "127.0.0.1", at: daysAgo(20) },
      { action: "blogger.application.approved", actorType: "admin", actorId: maya.id, details: "Maya Chen <demo@aitoolfinder.dev>", ip: "127.0.0.1", at: daysAgo(19) },
      { action: "blog.post.published", actorType: "admin", actorId: maya.id, details: "10 ChatGPT Prompts That Actually Save You Time", ip: "127.0.0.1", at: daysAgo(6) },
      { action: "donation.completed", actorType: "visitor", actorId: "", details: "Marcus T. — $50.00", ip: "127.0.0.1", at: daysAgo(3) },
    ];
    await db.auditLog.createMany({
      data: entries.map((e) => ({
        action: e.action,
        actorType: e.actorType,
        actorId: e.actorId,
        details: e.details,
        ip: e.ip,
        createdAt: e.at,
      })),
    });
    console.log("  + audit entries:", entries.length);
  }

  console.log("\nSEED COMPLETE");
  console.log("  Blogger demo login: demo@aitoolfinder.dev / Blogger-Demo-2025-Pass-Abc123");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
