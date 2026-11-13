/**
 * Seed script: verified AI tool catalog.
 * Idempotent — safe to re-run (upserts by slug).
 * Run with: pnpm db:seed (or: bunx tsx prisma/seed.ts)
 */
import "dotenv/config"; // Prisma 7 no longer auto-loads .env
import { db } from "../src/lib/db";

const DAY = 24 * 60 * 60 * 1000;
// "Pricing last checked" dates: spread over the two weeks before today.
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

interface SeedCategory {
  name: string;
  slug: string;
  icon: string;
  description: string;
}

const CATEGORIES: SeedCategory[] = [
  { name: "Writing", slug: "writing", icon: "PenLine", description: "Draft, edit, and polish text — emails, articles, and marketing copy." },
  { name: "Coding", slug: "coding", icon: "Code2", description: "Write, debug, and refactor code with AI pair programmers." },
  { name: "Images", slug: "images", icon: "Image", description: "Generate and edit illustrations, photos, logos, and designs." },
  { name: "Video", slug: "video", icon: "Clapperboard", description: "Create and edit videos from text, images, and avatars." },
  { name: "Audio", slug: "audio", icon: "AudioLines", description: "Transcribe speech, synthesize voices, and make music." },
  { name: "Research", slug: "research", icon: "Telescope", description: "Search the web and academic papers with cited answers." },
  { name: "Education", slug: "education", icon: "GraduationCap", description: "Tutors, flashcards, and study helpers for learners and teachers." },
  { name: "Automation", slug: "automation", icon: "Workflow", description: "Connect apps and automate repetitive workflows." },
  { name: "Productivity", slug: "productivity", icon: "Rocket", description: "AI meeting notes, presentations, and documents that save you hours." },
];

interface SeedTool {
  slug: string;
  name: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  example: string;
  freePlanLimits: string;
  useCases: string;
  officialUrl: string;
  pricingModel: "FREE" | "FREEMIUM" | "PAID";
  hasFreeTrial: boolean;
  trialNote: string;
  checkedDaysAgo: number;
}

const TOOLS: SeedTool[] = [
  // ---------------------------------------------------------------- Writing
  {
    slug: "chatgpt",
    name: "ChatGPT",
    categorySlug: "writing",
    shortDescription: "All-round AI assistant that drafts text, brainstorms, summarizes documents, and writes code.",
    description:
      "ChatGPT is a general-purpose AI assistant from OpenAI. It drafts and edits text, brainstorms ideas, summarizes documents and PDFs, writes and debugs code, analyzes images, and browses the web for current information.",
    example:
      "Paste your rough meeting notes and ask: “Turn these into a polite follow-up email to my client, under 150 words.”",
    freePlanLimits: "Free plan includes daily message limits with the standard model, file uploads, and web browsing; frontier models and higher limits require a paid plan.",
    useCases: "write an email, draft a blog post, brainstorm ideas, summarize a document, edit and proofread text, translate languages, homework help",
    officialUrl: "https://chatgpt.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "claude",
    name: "Claude",
    categorySlug: "writing",
    shortDescription: "AI assistant known for careful writing, long-document analysis, and step-by-step reasoning.",
    description:
      "Claude is an AI assistant made by Anthropic. It excels at long-form writing, editing for tone and clarity, analyzing lengthy documents such as contracts or reports, and reasoning through complex problems, including coding help.",
    example:
      "Upload a 100-page PDF report and ask for a one-page executive summary with the top five risks called out.",
    freePlanLimits: "Free plan includes daily message limits, file analysis, and Artifacts; longer context windows and higher limits come with paid plans.",
    useCases: "write long documents, summarize a PDF, analyze a contract, writing help, brainstorming, edit prose, coding help",
    officialUrl: "https://claude.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 1,
  },
  {
    slug: "grammarly",
    name: "Grammarly",
    categorySlug: "writing",
    shortDescription: "Writing assistant that fixes grammar, spelling, and clarity as you type, everywhere you write.",
    description:
      "Grammarly checks your writing in real time across browsers, documents, and email clients. Beyond catching mistakes, it suggests clarity rewrites, detects tone, and offers full-sentence rewrites with its generative AI features.",
    example:
      "Draft a cover letter in the Grammarly editor and accept its suggestions to make every sentence concise and confident.",
    freePlanLimits: "Free plan includes grammar, spelling, and punctuation checks plus basic tone detection; generative AI prompts and style guides require Premium.",
    useCases: "check grammar, fix spelling mistakes, improve clarity, adjust tone, proofread an essay, edit a resume",
    officialUrl: "https://www.grammarly.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "quillbot",
    name: "QuillBot",
    categorySlug: "writing",
    shortDescription: "Paraphrasing and summarizing toolkit for rewriting any text in different styles.",
    description:
      "QuillBot rewrites sentences and paragraphs in a range of tones — formal, simple, fluent, academic — and summarizes long articles into key points. It also includes a grammar checker, citation generator, and translator.",
    example:
      "Paste a dense paragraph of academic text and use the Paraphraser in “Simple” mode to make it readable for a general audience.",
    freePlanLimits: "Free plan paraphrases up to 125 words at a time and summarizes up to 1,200 words; paid plans raise the limits and unlock all modes.",
    useCases: "paraphrase text, rewrite a sentence, summarize an article, avoid plagiarism, simplify academic text",
    officialUrl: "https://quillbot.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },
  {
    slug: "jasper",
    name: "Jasper",
    categorySlug: "writing",
    shortDescription: "AI copywriter built for marketing teams to create on-brand content at scale.",
    description:
      "Jasper is a marketing-focused writing platform. It learns your brand voice, generates campaigns across formats — ads, emails, blogs, social posts — and includes templates and workflows designed for content teams.",
    example:
      "Give Jasper a one-line brief and generate ten Instagram captions in your brand voice, then export them straight to your content calendar.",
    freePlanLimits: "",
    useCases: "write marketing copy, create ad campaigns, write blog posts at scale, brand voice content, social media captions",
    officialUrl: "https://www.jasper.ai",
    pricingModel: "PAID",
    hasFreeTrial: true,
    trialNote: "7-day free trial",
    checkedDaysAgo: 12,
  },
  // ---------------------------------------------------------------- Coding
  {
    slug: "github-copilot",
    name: "GitHub Copilot",
    categorySlug: "coding",
    shortDescription: "AI pair programmer that autocompletes code and explains snippets inside your editor.",
    description:
      "GitHub Copilot integrates with VS Code, JetBrains, and other editors to suggest whole lines and functions as you type. It can explain unfamiliar code, generate unit tests, and answer questions about your repository in chat.",
    example:
      "Type a comment like “// function to resize an uploaded image to 300px” and let Copilot draft the implementation, then accept or refine it.",
    useCases: "autocomplete code, write a function, explain code, generate unit tests, pair programming, learn a new language",
    officialUrl: "https://github.com/features/copilot",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    freePlanLimits: "Copilot Free includes around 2,000 code completions and 50 chat messages per month at no cost, no credit card required; Pro raises limits and adds more models. Free for verified students and teachers.",
    checkedDaysAgo: 1,
  },
  {
    slug: "cursor",
    name: "Cursor",
    categorySlug: "coding",
    shortDescription: "AI-first code editor that writes, refactors, and explains code across your whole project.",
    description:
      "Cursor is a full code editor (a VS Code fork) with AI built into every part of it. Its chat and composer modes can make multi-file edits, fix bugs across the codebase, and answer questions grounded in your project's context.",
    example:
      "Ask Cursor to “add dark mode to this app,” review the multi-file diff it proposes, and accept the changes in one click.",
    freePlanLimits: "Free plan includes limited AI completions and chat requests over a two-week window; heavier usage requires the Pro plan.",
    useCases: "ai code editor, refactor a project, fix a bug, write a feature, code review, explain a codebase",
    officialUrl: "https://cursor.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "windsurf",
    name: "Windsurf",
    categorySlug: "coding",
    shortDescription: "AI code editor with an agent that plans and implements multi-step coding tasks.",
    description:
      "Windsurf (formerly Codeium) is an AI-native editor whose agent can take a goal, explore your repository, plan changes across files, and implement them while you steer. It also offers fast inline completions.",
    example:
      "Describe a bug you're seeing; the agent locates the faulty file, proposes a fix, and runs your tests to confirm it.",
    freePlanLimits: "Free plan includes a starter allowance of agent credits and unlimited standard completions.",
    useCases: "ai code editor, coding agent, autocomplete while typing, debug an error, build a feature end to end",
    officialUrl: "https://windsurf.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "replit",
    name: "Replit",
    categorySlug: "coding",
    shortDescription: "Browser coding platform where an AI agent builds, runs, and deploys apps with you.",
    description:
      "Replit is a full development environment in the browser. Its AI agent can scaffold an entire app from a prompt, and you can edit the code, run it, and deploy it to a public URL without leaving the tab — ideal for quick prototypes and learning.",
    example:
      "Prompt: “Build a portfolio site with a contact form,” watch the agent create the project, then click Deploy to publish it.",
    freePlanLimits: "Free plan includes public apps, basic compute, and a small monthly allowance of AI agent usage.",
    useCases: "build an app in the browser, learn to code, deploy a project quickly, prototype an idea, no-setup coding",
    officialUrl: "https://replit.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },
  {
    slug: "tabnine",
    name: "Tabnine",
    categorySlug: "coding",
    shortDescription: "Privacy-focused AI code completion that can run fully inside your network.",
    description:
      "Tabnine predicts your next lines of code based on your codebase's patterns and can be deployed entirely on-premises, making it a common choice for teams with strict security or compliance requirements.",
    example:
      "Install the extension, and as you start typing a function, Tabnine completes it in your project's own style.",
    freePlanLimits: "Free plan offers basic short code completions; whole-line and whole-function completions and team personalization are paid.",
    useCases: "code completion, private ai coding assistant, autocomplete for teams, on-premise code ai",
    officialUrl: "https://www.tabnine.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 14,
  },
  // ---------------------------------------------------------------- Images
  {
    slug: "midjourney",
    name: "Midjourney",
    categorySlug: "images",
    shortDescription: "Text-to-image generator famous for striking, artistic, highly detailed visuals.",
    description:
      "Midjourney turns text prompts into some of the most aesthetically distinctive AI images available. It offers style references, character consistency, in-painting edits, and upscaling, and now runs both on the web and in Discord.",
    example:
      "Type “watercolor poster of a mountain sunrise, minimal palette,” pick your favorite of the four results, and upscale it for print.",
    freePlanLimits: "",
    useCases: "generate an image from text, create art, design a poster, concept art, book illustrations, mood boards",
    officialUrl: "https://www.midjourney.com",
    pricingModel: "PAID",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "leonardo-ai",
    name: "Leonardo.Ai",
    categorySlug: "images",
    shortDescription: "Image generation suite with fine control over styles and consistent characters.",
    description:
      "Leonardo.Ai generates and edits images with a strong toolbox: style presets, custom models you can train on your own images, real-time canvas drawing, and upscaling. Popular with game studios and product designers.",
    example:
      "Train a small model on 10 photos of your product, then generate consistent marketing shots in any scene you describe.",
    freePlanLimits: "Free plan includes a daily allowance of generation tokens (roughly dozens of images), refreshed every 24 hours.",
    useCases: "generate images, product photography, game assets, consistent characters, real-time image generation, upscale images",
    officialUrl: "https://leonardo.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 9,
  },
  {
    slug: "ideogram",
    name: "Ideogram",
    categorySlug: "images",
    shortDescription: "Image generator that is especially good at rendering readable text inside images.",
    description:
      "Ideogram specializes in typography — logos, posters, greeting cards, and label designs where the words must actually be spelled correctly. It offers style presets, magic prompts, and an editor for refining regions of an image.",
    example:
      "Create a birthday card image with the greeting “Happy 30th, Maya!” rendered in elegant hand-lettering — spelled perfectly.",
    freePlanLimits: "Free plan includes a limited number of slow-generation images per day and a small daily allowance of higher-quality generations.",
    useCases: "images with text, design a logo, make a poster, greeting cards, typography art, t-shirt designs",
    officialUrl: "https://ideogram.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 10,
  },
  {
    slug: "canva-magic-studio",
    name: "Canva Magic Studio",
    categorySlug: "images",
    shortDescription: "Full design platform with AI image, text, and layout tools built in.",
    description:
      "Canva is an easy drag-and-drop design tool for social posts, presentations, and documents. Magic Studio layers AI on top: text-to-image, magic edit and eraser, background removal, and AI drafts of whole presentations from a prompt.",
    example:
      "Type “pitch deck for a coffee subscription startup” into Magic Design and get a complete, on-brand presentation draft in minutes.",
    freePlanLimits: "Free plan includes Canva's core design tools and a limited number of AI credits; most Magic Studio features require Pro.",
    useCases: "design graphics, make a presentation, social media posts, remove a background, ai design, edit photos",
    officialUrl: "https://www.canva.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: true,
    trialNote: "30-day Pro trial",
    checkedDaysAgo: 3,
  },
  {
    slug: "krea-ai",
    name: "Krea AI",
    categorySlug: "images",
    shortDescription: "Real-time image generation and AI enhancement for photos and renders.",
    description:
      "Krea renders images live as you draw or move shapes on a canvas, and includes powerful enhancers: upscaling, “enhance” to repixelate sketches into polished renders, and real-time video. Favored by designers who iterate visually.",
    example:
      "Sketch a rough chair silhouette on the canvas and watch Krea render a photoreal product shot as you refine the shapes.",
    freePlanLimits: "Free plan includes limited daily compute for generations and enhancements, with queues at busy times.",
    useCases: "real-time image generation, enhance a sketch, upscale a photo, product renders, iterate on designs visually",
    officialUrl: "https://www.krea.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 11,
  },
  // ---------------------------------------------------------------- Video
  {
    slug: "runway",
    name: "Runway",
    categorySlug: "video",
    shortDescription: "AI video suite for generating and editing video from text and images.",
    description:
      "Runway is a full AI video toolkit: text-to-video, image-to-video, motion brush to animate parts of a still, video-to-video restyling, green screen, and inpainting. It's used for ads, music videos, and short films.",
    example:
      "Upload one product photo, use image-to-video with a slow camera push, and get a five-second animated ad clip.",
    freePlanLimits: "Free plan includes a one-time starter allocation of credits for video generation and basic editing tools.",
    useCases: "generate a video from text, animate an image, video editing, remove a background from video, special effects, b-roll",
    officialUrl: "https://runwayml.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "pika",
    name: "Pika",
    categorySlug: "video",
    shortDescription: "Playful text-to-video generator for short clips, effects, and social content.",
    description:
      "Pika turns prompts, images, and even text conversations into short video clips with fun one-click effects — inflate, melt, explode — plus lip sync and sound effects. Great for memes, teasers, and social posts.",
    example:
      "Type “a corgi surfing a wave at sunset, cinematic slow motion” and share the resulting clip straight to social media.",
    freePlanLimits: "Free plan includes limited monthly credits for video generation with a watermark.",
    useCases: "generate a short video, social media clips, video effects, animate a photo, lip sync video",
    officialUrl: "https://pika.art",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },
  {
    slug: "heygen",
    name: "HeyGen",
    categorySlug: "video",
    shortDescription: "Studio-quality presenter videos from a script — AI avatars, no camera needed.",
    description:
      "HeyGen turns written scripts into videos of talking AI avatars, with 100+ stock avatars or a clone of yourself. It handles voice, lip sync, and even translation of your video into other languages with matching lip movement.",
    example:
      "Paste your onboarding script, pick a presenter, and download a two-minute training video — no filming or editing required.",
    freePlanLimits: "Free plan includes up to 3 videos per month with a watermark and limited duration.",
    useCases: "talking avatar video, training videos, product demos, translate a video into other languages, sales outreach videos",
    officialUrl: "https://www.heygen.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "descript",
    name: "Descript",
    categorySlug: "video",
    shortDescription: "Edit audio and video as easily as a text document, by editing the transcript.",
    description:
      "Descript transcribes your recordings, then lets you edit them like a doc — delete a sentence in the text and it disappears from the video. It also removes filler words (“um”, “uh”), records your screen, and clones your voice for corrections.",
    example:
      "Delete the filler-word sentences in your podcast transcript and watch your episode get 15% shorter automatically.",
    freePlanLimits: "Free plan includes 1 hour of transcription per month, unlimited screen recordings, and watermarked exports.",
    useCases: "edit a video by transcript, podcast editing, remove filler words, add captions, screen recording, youtube videos",
    officialUrl: "https://www.descript.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  // ---------------------------------------------------------------- Audio
  {
    slug: "otter-ai",
    name: "Otter.ai",
    categorySlug: "audio",
    shortDescription: "AI meeting assistant that records, transcribes, and summarizes your conversations.",
    description:
      "Otter joins your Zoom, Google Meet, or Teams calls (or your phone microphone), writes a live transcript, and produces automated meeting notes with summaries and action items you can share with the team.",
    example:
      "Connect Otter to your calendar: it joins your client calls, writes the notes, and emails everyone the action items afterward.",
    freePlanLimits: "Free plan includes 300 minutes of transcription per month with a limited number of integrations.",
    useCases: "transcribe a meeting, meeting notes, record an interview, summarize a call, capture action items, lecture transcription",
    officialUrl: "https://otter.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 1,
  },
  {
    slug: "elevenlabs",
    name: "ElevenLabs",
    categorySlug: "audio",
    shortDescription: "Startlingly realistic text-to-speech and voice cloning in 30+ languages.",
    description:
      "ElevenLabs converts text into natural speech with lifelike pacing and emotion, clones voices from short audio samples, and dubbs existing videos into other languages while preserving the original speaker's voice.",
    example:
      "Paste your latest blog post, choose a warm narrator voice, and download the audio version as an MP3 for your podcast feed.",
    freePlanLimits: "Free plan includes 10,000 characters of text-to-speech per month with attribution required.",
    useCases: "text to speech, voiceover for videos, audiobook narration, clone a voice, dub a video into another language",
    officialUrl: "https://elevenlabs.io",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },
  {
    slug: "suno",
    name: "Suno",
    categorySlug: "audio",
    shortDescription: "Generate complete songs — vocals, lyrics, and instruments — from a description.",
    description:
      "Suno creates full-length songs from a text prompt: pick a genre, mood, or topic, optionally write your own lyrics, and it produces a mixed, mastered track you can download or extend into longer pieces.",
    example:
      "Prompt “upbeat acoustic song about Mondays and coffee” and get a two-minute track with vocals — then download the MP3.",
    freePlanLimits: "Free plan includes 50 credits per day (about 10 songs) for personal, non-commercial use.",
    useCases: "make a song from text, background music for videos, custom birthday songs, songwriting help, jingles",
    officialUrl: "https://suno.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "whisper",
    name: "Whisper",
    categorySlug: "audio",
    shortDescription: "Open-source speech-to-text from OpenAI that you can run yourself, in 90+ languages.",
    description:
      "Whisper is OpenAI's open-source transcription model. Run it on your own machine to convert audio files into accurate text with timestamps — including in noisy recordings and 90+ languages — with no data leaving your computer.",
    example:
      "Run Whisper on a recorded lecture to get a searchable, timestamped transcript you can turn into study notes.",
    freePlanLimits: "Completely free and open source (MIT license) — you provide the compute by running it locally or on a server.",
    useCases: "transcribe audio, speech to text, subtitle a video, offline transcription, self-hosted meeting transcription",
    officialUrl: "https://github.com/openai/whisper",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 13,
  },
  {
    slug: "adobe-podcast",
    name: "Adobe Podcast",
    categorySlug: "audio",
    shortDescription: "Free web tools that make voice recordings sound like they came from a studio.",
    description:
      "Adobe Podcast's Enhance Speech removes echo, background noise, and room reverb from voice recordings in one click, and its Studio tool gives you a browser-based multitrack podcast recorder.",
    example:
      "Upload a noisy Zoom recording and let Enhance Speech clean it up so it sounds like a proper microphone was used.",
    freePlanLimits: "Enhance Speech is free to use with daily processing limits; a free Adobe account may be required.",
    useCases: "clean up audio, remove background noise from a voice recording, enhance speech, podcast recording, improve voice quality",
    officialUrl: "https://podcast.adobe.com",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 9,
  },
  // ---------------------------------------------------------------- Research
  {
    slug: "perplexity",
    name: "Perplexity",
    categorySlug: "research",
    shortDescription: "AI search engine that answers questions with cited, up-to-date sources.",
    description:
      "Perplexity combines web search with an AI summarizer: ask a question and it reads the top sources, then writes a direct answer with numbered citations you can click through. Great for current events and comparison research.",
    example:
      "Ask “What changed in EU AI regulation this year?” and get a concise, sourced summary with links to the primary documents.",
    freePlanLimits: "Free plan includes unlimited quick searches and a daily allowance of Pro searches with model choice.",
    useCases: "research a question, cited answers, fact-check a claim, current events, compare products, alternatives to google search",
    officialUrl: "https://www.perplexity.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 1,
  },
  {
    slug: "notebooklm",
    name: "NotebookLM",
    categorySlug: "research",
    shortDescription: "Research assistant grounded in your own documents, with source citations.",
    description:
      "NotebookLM (from Google) answers questions strictly from the sources you upload — PDFs, docs, links, YouTube videos — always citing where each claim came from. It can also generate study guides, FAQs, and an AI “audio overview” podcast of your materials.",
    example:
      "Upload five lecture PDFs and generate a study guide plus an audio overview podcast to listen to on the way to class.",
    freePlanLimits: "Free to use with a Google account, with source and daily query limits on the free tier.",
    useCases: "summarize documents, study materials, audio overviews, research notes, source-grounded answers, organize references",
    officialUrl: "https://notebooklm.google",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "elicit",
    name: "Elicit",
    categorySlug: "research",
    shortDescription: "AI research assistant for finding and analyzing academic papers.",
    description:
      "Elicit searches 125 million academic papers, then extracts the findings you care about into comparison tables — sample sizes, methods, outcomes — so you can review a literature landscape in minutes instead of weeks.",
    example:
      "Ask “What does research say about spaced repetition for learning?” and get a table of papers with their key findings side by side.",
    freePlanLimits: "Free plan includes a monthly allowance of search and extraction credits.",
    useCases: "find academic papers, literature review, extract findings from studies, summarize research, systematic review",
    officialUrl: "https://elicit.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },
  {
    slug: "consensus",
    name: "Consensus",
    categorySlug: "research",
    shortDescription: "Search engine that answers questions using the academic literature itself.",
    description:
      "Consensus searches peer-reviewed papers to answer questions like “does creatine improve cognition?” — showing you the percentage of studies that support the claim and the underlying papers, with an AI-synthesized summary.",
    example:
      "Type “Is mindfulness effective for anxiety?” and see a consensus meter plus the top studies on each side.",
    freePlanLimits: "Free plan includes unlimited searches and a limited number of AI-synthesized research reports per month.",
    useCases: "check a scientific claim, evidence-based answers, find papers, academic search, settle a debate with evidence",
    officialUrl: "https://consensus.app",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 10,
  },
  {
    slug: "scite-ai",
    name: "Scite AI",
    categorySlug: "research",
    shortDescription: "Citation tracker showing whether papers support or contradict a claim.",
    description:
      "Scite classifies every citation a paper receives as supporting, contrasting, or mentioning. Look up any study and instantly see how the scientific community has reacted to it — an authenticity check for influential research.",
    example:
      "Look up a famous psychology study and see how many later papers supported its findings versus disputing them.",
    freePlanLimits: "",
    useCases: "check citations, evaluate a paper's credibility, literature research, smart citations, verify a study",
    officialUrl: "https://scite.ai",
    pricingModel: "PAID",
    hasFreeTrial: true,
    trialNote: "7-day free trial",
    checkedDaysAgo: 12,
  },
  // ---------------------------------------------------------------- Education
  {
    slug: "khanmigo",
    name: "Khanmigo",
    categorySlug: "education",
    shortDescription: "AI tutor from Khan Academy that guides students instead of giving answers.",
    description:
      "Khanmigo is Khan Academy's AI tutor, trained on Socratic pedagogy: it asks guiding questions, gives hints, and checks understanding step by step rather than just handing over solutions. It covers math, science, and humanities, and has teacher tools for lesson planning.",
    example:
      "Ask it for help with a fractions problem — it walks you through with questions until you arrive at the answer yourself.",
    freePlanLimits: "",
    useCases: "ai tutor, homework help, math practice, learn step by step, teacher lesson planning, sat prep",
    officialUrl: "https://www.khanmigo.ai",
    pricingModel: "PAID",
    hasFreeTrial: false,
    trialNote: "Free for US teachers; learners pay $4/month",
    checkedDaysAgo: 11,
  },
  {
    slug: "quizlet",
    name: "Quizlet",
    categorySlug: "education",
    shortDescription: "Study tools and flashcards with an AI tutor built from your own material.",
    description:
      "Quizlet turns your notes into flashcards, practice tests, and match games. Its AI tutor Q-Chat quizzes you conversationally from your own study set, adapting to what you keep getting wrong.",
    example:
      "Upload your biology notes, auto-generate a flashcard set, then let Q-Chat quiz you the night before the exam.",
    freePlanLimits: "Free plan includes unlimited flashcard sets and practice rounds plus a limited number of AI tutor chats.",
    useCases: "flashcards, study for an exam, practice tests, learn vocabulary, memorize facts, ai study tutor",
    officialUrl: "https://quizlet.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "socratic-by-google",
    name: "Socratic by Google",
    categorySlug: "education",
    shortDescription: "Free homework helper that explains questions with step-by-step resources.",
    description:
      "Socratic is a free Google app for high-school students: snap a photo of a homework question (or type it) and it surfaces explanations, videos, and step-by-step help across math, science, history, and literature.",
    example:
      "Photograph an algebra equation you're stuck on and get worked explanations plus a video covering the concept.",
    freePlanLimits: "Completely free — no account required.",
    useCases: "homework help, explain a math problem, study help for students, free tutoring, high school subjects",
    officialUrl: "https://socratic.org",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 13,
  },
  // ---------------------------------------------------------------- Automation
  {
    slug: "zapier",
    name: "Zapier",
    categorySlug: "automation",
    shortDescription: "Connects 7,000+ apps and automates workflows with AI steps built in.",
    description:
      "Zapier links your apps together so a trigger in one (“new email with attachment”) causes actions in others (“save to Drive, post to Slack”). Its AI steps can draft the Slack message or summarize the document as part of the flow — no code required.",
    example:
      "Create a Zap that saves email attachments to Google Drive and posts an AI-written summary of each to your team's Slack channel.",
    freePlanLimits: "Free plan includes 100 task runs per month and unlimited two-step Zaps.",
    useCases: "automate a task, connect apps, no-code workflows, ai automation, save email attachments, sync data between apps",
    officialUrl: "https://zapier.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },
  {
    slug: "make",
    name: "Make",
    categorySlug: "automation",
    shortDescription: "Visual automation platform for building complex multi-app workflows.",
    description:
      "Make gives you a visual canvas where you drag modules — triggers, filters, AI calls, app actions — into branching scenarios with error handling. More powerful than simple if-this-then-that, still no code.",
    example:
      "Draw a scenario that watches a form, enriches new leads with an AI summary of their company, and adds them to your CRM.",
    freePlanLimits: "Free plan includes 1,000 operations per month and unlimited scenarios.",
    useCases: "visual automation, workflow builder, connect apps, no-code integrations, data pipelines, lead enrichment",
    officialUrl: "https://www.make.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },
  {
    slug: "n8n",
    name: "n8n",
    categorySlug: "automation",
    shortDescription: "Source-available automation platform you can self-host or run in the cloud.",
    description:
      "n8n is a workflow automation tool with 400+ integrations, branching logic, and AI agent nodes. Self-host the community edition for free to keep everything on your own infrastructure, or use the managed cloud.",
    example:
      "Self-host n8n and build a bot that watches a support inbox, drafts AI replies for approval, and logs tickets in Notion.",
    freePlanLimits: "Self-hosting the community edition is free and unlimited; the cloud tier is paid with a free trial.",
    useCases: "self-hosted automation, advanced workflows, ai agents, connect apis, data pipelines, keep data private",
    officialUrl: "https://n8n.io",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 10,
  },

  // ---------------------------------------------------- Writing (new additions)
  {
    slug: "google-gemini",
    name: "Google Gemini",
    categorySlug: "writing",
    shortDescription: "Google's AI assistant that writes, analyzes files, and plugs into Gmail, Docs, and Search.",
    description:
      "Gemini is Google's flagship AI assistant. It drafts and rewrites text, summarizes PDFs and images, answers questions with Google Search grounding, and works inside Gmail, Docs, and other Workspace apps. A capable model is available free, with higher limits on paid plans.",
    example:
      "Upload a research PDF and ask Gemini for a bullet summary, then say “turn this into an email to my team” — all in one chat.",
    freePlanLimits: "Free tier includes daily message limits, file uploads, and Search grounding; higher limits and Veo video generation come with paid plans.",
    useCases: "write an email, summarize a pdf, brainstorm ideas, google search answers, analyze a photo, homework help, draft in gmail",
    officialUrl: "https://gemini.google.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "google-ai-studio",
    name: "Google AI Studio",
    categorySlug: "writing",
    shortDescription: "Free playground for testing Gemini models with generous limits — a power user's ChatGPT.",
    description:
      "Google AI Studio is a free web playground for Google's Gemini models. You get long context windows, file and image uploads, system instructions, and prompt tuning — all at no cost with generous rate limits. It's one of the most capable free AI environments available, aimed at developers and enthusiasts.",
    example:
      "Paste a 50-page contract into AI Studio and ask pointed questions about the termination clause — the long context window can handle it on the free tier.",
    freePlanLimits: "Free to use with generous rate limits on Gemini models, including file uploads and long context; you only pay if you use the API in production.",
    useCases: "test ai models, free chatgpt alternative, long document analysis, prompt engineering, compare gemini models, free api key",
    officialUrl: "https://aistudio.google.com",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },
  {
    slug: "microsoft-copilot",
    name: "Microsoft Copilot",
    categorySlug: "writing",
    shortDescription: "Free AI assistant from Microsoft with web answers, image generation, and Office integration.",
    description:
      "Microsoft Copilot is a free AI chatbot powered by OpenAI models. It answers questions with web sources, generates images, drafts text, and integrates with Windows and Microsoft 365 apps. A paid Copilot Pro tier adds priority access and Office integration.",
    example:
      "Ask Copilot to research a topic with citations, then have it draft the findings as a Word-ready outline.",
    freePlanLimits: "Free tier includes chat with web grounding and image generation with daily limits; Copilot Pro adds priority models and deeper Office integration.",
    useCases: "free ai chatbot, research with citations, generate images, draft text, windows assistant, bing chat",
    officialUrl: "https://copilot.microsoft.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    categorySlug: "writing",
    shortDescription: "Free, open-weight AI chatbot with strong reasoning and coding skills — no subscription needed.",
    description:
      "DeepSeek is a Chinese AI lab whose chatbot is completely free to use. Its models handle reasoning, math, coding, and long documents well, and the open-weight models can be run locally or via cheap API access, which has made it a popular free alternative to paid assistants.",
    example:
      "Paste a tricky logic puzzle or a chunk of code with a bug and ask DeepSeek to reason through it step by step — for free.",
    freePlanLimits: "The web and mobile chat is free to use; the API is pay-as-you-go with very low per-token prices, and open-weight models can be self-hosted at no license cost.",
    useCases: "free ai chatbot, reasoning, math problems, debug code, free chatgpt alternative, translate, write an essay",
    officialUrl: "https://chat.deepseek.com",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "grok",
    name: "Grok",
    categorySlug: "writing",
    shortDescription: "xAI's assistant with real-time knowledge from X (Twitter) and a free daily allowance.",
    description:
      "Grok is xAI's chatbot, known for its real-time awareness of what's happening on X and its less-guarded personality. It writes, brainstorms, analyzes images, and answers current-events questions. A free tier is available on grok.com and inside X, with higher limits for SuperGrok subscribers.",
    example:
      "Ask Grok what people on X are saying about a breaking story, then ask it to draft a balanced summary for your newsletter.",
    freePlanLimits: "Free tier includes a daily allowance of messages and image generations on grok.com and in the X app; SuperGrok raises limits and adds newer models.",
    useCases: "real-time news, twitter search, write a newsletter, brainstorm, analyze images, free ai chatbot",
    officialUrl: "https://grok.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "deepl-write",
    name: "DeepL Write",
    categorySlug: "writing",
    shortDescription: "AI writing companion that polishes your text for clarity, tone, and precision.",
    description:
      "DeepL Write is a free editor from the translation company DeepL. Paste any text and it rewrites it with better word choice, clearer phrasing, and a consistent tone — with alternatives shown for every suggestion. It shines at professional business writing in English, German, French, and other languages.",
    example:
      "Paste a clumsy paragraph from a client email, click once, and choose between the more formal, more casual, or more concise rewrites.",
    freePlanLimits: "Free to use in the browser with a text length limit per pass; DeepL Pro removes length limits and adds style/tone options.",
    useCases: "improve writing, rewrite text, business email, professional tone, polish english, fix awkward phrasing",
    officialUrl: "https://www.deepl.com/write",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },
  {
    slug: "copy-ai",
    name: "Copy.ai",
    categorySlug: "writing",
    shortDescription: "AI copywriter with ready-made workflows for marketing text, product pages, and campaigns.",
    description:
      "Copy.ai focuses on go-to-market content: product descriptions, ad copy, email sequences, and blog frameworks. Instead of a blank chat box, you get guided workflows and templates, and the free plan is enough to test real projects.",
    example:
      "Use the product description workflow: paste your product bullet points and get three ready-to-test descriptions with different hooks.",
    freePlanLimits: "Free plan includes 2,000 words per month, one seat, and access to core workflows; paid plans raise limits and add brand voice.",
    useCases: "write marketing copy, product description, ad copy, email sequence, blog outline, content ideas",
    officialUrl: "https://www.copy.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 9,
  },
  {
    slug: "rytr",
    name: "Rytr",
    categorySlug: "writing",
    shortDescription: "Lightweight AI writer with 40+ templates and a free monthly allowance that never expires.",
    description:
      "Rytr is a simple, affordable AI writing tool with templates for emails, blog sections, product descriptions, and social posts. You pick a tone, feed it a few bullets, and get a draft in seconds. The lifetime free plan gives you a fresh allowance of characters every month.",
    example:
      "Pick the “email” template, choose a sincere tone, paste three bullet points about a project delay, and send the polished apology.",
    freePlanLimits: "Free plan includes 10,000 characters per month forever, over 40 templates, and 30+ languages; paid plans add more characters and custom use cases.",
    useCases: "write an email, social media caption, product description, blog intro, free ai writer, short content",
    officialUrl: "https://rytr.me",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 11,
  },

  // ----------------------------------------------------- Coding (new additions)
  {
    slug: "gemini-code-assist",
    name: "Gemini Code Assist",
    categorySlug: "coding",
    shortDescription: "Google's free AI coding assistant with the most generous completion quota in the industry.",
    description:
      "Gemini Code Assist brings Google's Gemini models into VS Code and JetBrains editors for AI chat, code completion, and explanations. The free tier for individuals offers an unusually large allowance — up to 180,000 code completions per month — far beyond what most competitors give away.",
    example:
      "Install the extension in VS Code, open a messy legacy file, and ask “explain what this module does” — then request unit tests.",
    freePlanLimits: "Free for individuals: up to 180,000 code completions and 240 chat or agent interactions per month, with a generous context window; paid tiers add higher limits and enterprise controls.",
    useCases: "free code completion, ai chat in editor, explain code, generate unit tests, refactor, vs code extension, jetbrains plugin",
    officialUrl: "https://developers.google.com/gemini-code-assist",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "sourcegraph-cody",
    name: "Sourcegraph Cody",
    categorySlug: "coding",
    shortDescription: "AI coding assistant that reads your whole codebase to answer questions and write code.",
    description:
      "Cody uses Sourcegraph's code graph to understand your entire repository — not just the open file — so its answers and completions carry context from across your project. It works in VS Code, JetBrains, and on the web, and the free tier is fine for everyday use.",
    example:
      "Ask Cody “where is session token validation handled?” and get file-accurate answers with links, not guesses.",
    freePlanLimits: "Free tier includes unlimited code search, AI chat, and autocomplete with monthly interaction limits; paid plans raise limits and add enterprise features.",
    useCases: "codebase question answering, autocomplete, find code, explain a repository, ai pair programmer, vs code extension",
    officialUrl: "https://sourcegraph.com/cody",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "amazon-q-developer",
    name: "Amazon Q Developer",
    categorySlug: "coding",
    shortDescription: "AWS's AI coding assistant with a free tier for autocomplete, chat, and code transformation.",
    description:
      "Amazon Q Developer is AWS's coding agent, available in VS Code, JetBrains, and the AWS console. It generates code, explains errors, scans for security vulnerabilities, and transforms legacy code (like Java upgrades). A free tier is available simply by signing in with an AWS Builder ID.",
    example:
      "Install the extension, select an old Java 8 class, and run a code transform to modernize it to Java 17 with a reviewable diff.",
    freePlanLimits: "Free tier includes a monthly allowance of interactions, autocomplete, and agent tasks with an AWS Builder ID; Pro adds higher limits and enterprise features.",
    useCases: "code autocomplete, aws development, upgrade java, security scan, explain an error, code transformation",
    officialUrl: "https://aws.amazon.com/q/developer",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },
  {
    slug: "aider",
    name: "Aider",
    categorySlug: "coding",
    shortDescription: "Open-source AI pair programmer that lives in your terminal and edits files directly.",
    description:
      "Aider is a free, open-source command-line tool that turns AI models into a pair programmer. It edits files in your repo directly, commits to git with sensible messages, and works with many models — you bring your own API key, or connect free local models with Ollama.",
    example:
      "Run “aider” in your repo, type “add input validation to the signup form”, review the diff, and let it auto-commit when you approve.",
    freePlanLimits: "The tool itself is free and open source; you bring your own model via an API key, or use free local models with Ollama for zero cost.",
    useCases: "terminal ai, edit files with ai, git integration, pair programming, open source, local models, refactor a repository",
    officialUrl: "https://aider.chat",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "cline",
    name: "Cline",
    categorySlug: "coding",
    shortDescription: "Free open-source AI agent for VS Code that plans, codes, and fixes across your project.",
    description:
      "Cline is an open-source VS Code extension that acts as an autonomous coding agent: it reads your project, plans multi-step changes, creates and edits files, runs terminal commands, and fixes its own errors — all with your approval at each step. Free to use with any model, including local ones.",
    example:
      "Ask Cline to “add dark mode to this app” and watch it plan the steps, touch the right files, and ask before running each change.",
    freePlanLimits: "The extension is free and open source; you supply the model via API key or run free local models with Ollama or LM Studio.",
    useCases: "ai coding agent, vs code extension, autonomous coding, plan and implement features, open source, fix bugs",
    officialUrl: "https://cline.bot",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },

  // ----------------------------------------------------- Images (new additions)
  {
    slug: "google-imagefx",
    name: "Google ImageFX",
    categorySlug: "images",
    shortDescription: "Google's free AI image generator with fast results and prompt-refining chips.",
    description:
      "ImageFX is Google Labs' free text-to-image tool, powered by the Imagen model. You type a prompt, get four variations, and can click suggested “expressive chips” to remix lighting, style, or subject. Simple, fast, and genuinely free.",
    example:
      "Type “a cozy cabin in the snow at dusk”, then click the “cinematic lighting” chip to instantly refine the mood.",
    freePlanLimits: "Free to use with a personal Google account, with a generous daily generation allowance and SynthID watermarking on outputs.",
    useCases: "free image generation, text to image, imagen, concept art, quick illustrations, prompt suggestions",
    officialUrl: "https://labs.google/fx/tools/image-fx",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "bing-image-creator",
    name: "Bing Image Creator",
    categorySlug: "images",
    shortDescription: "Microsoft's free DALL·E-powered image generator — boosts for speed, free forever.",
    description:
      "Bing Image Creator (inside Microsoft Designer and Copilot) generates images from text using DALL·E models. It's free with a Microsoft account, with daily “boosts” that speed up generation; when boosts run out, images still generate, just slower.",
    example:
      "Visit designer.microsoft.com, type “watercolor logo of a mountain bike shop”, and download your favorite of four options.",
    freePlanLimits: "Free with a Microsoft account; daily boost tokens make generation fast, and standard-speed generation continues after boosts are used up.",
    useCases: "free image generation, dall-e, logo ideas, illustrations, microsoft designer, text to image",
    officialUrl: "https://www.bing.com/images/create",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },
  {
    slug: "flux",
    name: "FLUX.1",
    categorySlug: "images",
    shortDescription: "Open-weight image model from Black Forest Labs — free to run, near-photo realism.",
    description:
      "FLUX.1 is the image model family from Black Forest Labs (the original Stable Diffusion team). The [schnell] variant is open-weight and free to run locally or on community sites, delivering some of the best prompt-following and text rendering available — including legible words inside images.",
    example:
      "Generate a poster with the exact headline text “JAZZ NIGHT FRIDAY” — FLUX renders readable typography, which most models butcher.",
    freePlanLimits: "FLUX.1 [schnell] is open-weight (Apache-2.0) and free to run locally or via free community playgrounds; the faster hosted API and pro models are paid.",
    useCases: "text to image, image with text, realistic images, open source model, run locally, free image generation, posters",
    officialUrl: "https://blackforestlabs.ai",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "stable-diffusion",
    name: "Stable Diffusion",
    categorySlug: "images",
    shortDescription: "The original open-source image model — free forever if you run it yourself.",
    description:
      "Stable Diffusion, from Stability AI, is the open-weight image model that started the AI art boom. Because the weights are free to download, you can generate unlimited images on your own computer with tools like ComfyUI or AUTOMATIC1111 — no subscriptions, no per-image costs, full privacy.",
    example:
      "Install ComfyUI, download the free SD 3.5 weights, and batch-generate 100 product photo concepts overnight — at zero cost.",
    freePlanLimits: "Open weights are free to download and run locally with no generation limits (community license); Stability's hosted API and online tools are paid.",
    useCases: "run locally, unlimited image generation, open source, comfyui, automatic1111, free ai art, offline image generation",
    officialUrl: "https://stability.ai",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "adobe-firefly",
    name: "Adobe Firefly",
    categorySlug: "images",
    shortDescription: "Adobe's commercially-safe image generator, bundled with free monthly credits.",
    description:
      "Firefly is Adobe's generative AI family, trained on licensed content so outputs are safe for commercial work. It powers generative fill in Photoshop and offers text-to-image, generative recolor, and texture generation on the web. Free credits refresh every month.",
    example:
      "Use Generative Fill in Photoshop to remove a tourist from your vacation photo — the free monthly credits cover a handful of fills.",
    freePlanLimits: "Free plan includes 25 generative credits per month for text-to-image and generative fill; paid plans add more credits and access to premium models.",
    useCases: "generative fill, edit a photo, commercially safe images, text to image, photoshop ai, product mockups",
    officialUrl: "https://firefly.adobe.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "craiyon",
    name: "Craiyon",
    categorySlug: "images",
    shortDescription: "The famously free AI image generator (formerly DALL·E mini) — unlimited, no sign-up.",
    description:
      "Craiyon, the successor to DALL·E mini, generates nine images per prompt with no account and no hard limit. Quality is more playful than photoreal, which makes it great for memes, brainstorms, and quick concepts where speed and zero cost matter more than polish.",
    example:
      "Type “a cat astronaut floating over Zurich” and instantly get nine quirky takes to pick from — no account needed.",
    freePlanLimits: "Free unlimited generations with ads and a wait between batches; paid plans remove ads, wait times, and watermarks.",
    useCases: "free unlimited images, meme generator, quick concept art, no signup, funny images, brainstorm visuals",
    officialUrl: "https://www.craiyon.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },
  {
    slug: "recraft",
    name: "Recraft",
    categorySlug: "images",
    shortDescription: "AI generator built for designers — vector art, icons, and brand-consistent styles.",
    description:
      "Recraft is the AI image tool made for design work: it generates true SVG vector illustrations, icon sets, and consistent brand styles, not just raster photos. Designers can train a custom style and generate matching assets across a whole project. The free daily credit allowance is one of the most generous around.",
    example:
      "Generate a flat vector icon set in a consistent style, download as SVG, and drop it straight into Figma.",
    freePlanLimits: "Free plan includes 50 credits per day for image and vector generation, with public image history; paid plans add private generations, style training, and higher resolution exports.",
    useCases: "vector art, svg icons, logo design, consistent style, brand assets, illustration, free daily credits",
    officialUrl: "https://www.recraft.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },

  // ------------------------------------------------------ Video (new additions)
  {
    slug: "kling-ai",
    name: "Kling AI",
    categorySlug: "video",
    shortDescription: "Viral text-to-video generator with daily free credits and startlingly realistic motion.",
    description:
      "Kling AI, from Kuaishou, is one of the most popular AI video generators — known for smooth human motion, prompt following, and lip-synced clips. Free credits refresh daily, which is enough to keep experimenting without paying.",
    example:
      "Upload a photo of your dog and prompt “the dog runs across a beach at sunset” — Kling animates it with convincing motion.",
    freePlanLimits: "Free plan includes daily credits (enough for a short clip) with watermark; paid plans add higher resolutions, longer clips, and faster generation.",
    useCases: "text to video, image to video, animate a photo, viral clips, lip sync, free daily credits",
    officialUrl: "https://klingai.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "luma-dream-machine",
    name: "Luma Dream Machine",
    categorySlug: "video",
    shortDescription: "Cinematic text-to-video with strong camera motion — free generations every month.",
    description:
      "Dream Machine, from Luma AI, turns text and images into cinematic clips with excellent camera moves — orbits, dollies, and pushes that make AI video feel directed. The free web tier lets you generate short watermarked clips each month.",
    example:
      "Prompt “drone shot orbiting a lighthouse at golden hour” and get a clip with a smooth, deliberate camera arc.",
    freePlanLimits: "Free tier includes a monthly allowance of generations (short 720p clips with watermark); paid plans remove watermarks and unlock longer, higher-resolution outputs.",
    useCases: "cinematic video, camera motion, text to video, image to video, drone shots, social content",
    officialUrl: "https://lumalabs.ai/dream-machine",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },
  {
    slug: "hailuo-ai",
    name: "Hailuo AI",
    categorySlug: "video",
    shortDescription: "MiniMax's video generator with generous daily free credits — a meme factory.",
    description:
      "Hailuo AI (from MiniMax) generates expressive, often humorous video clips from text and images. It's optimized for character motion and expressive reactions, which made it a favorite for memes and social content. The daily free allowance is among the most generous of any video tool.",
    example:
      "Prompt “a cat chef dramatically chopping vegetables in slow motion” and watch Hailuo nail the drama.",
    freePlanLimits: "Free plan includes daily generation credits (varies by region) with watermark; paid plans add higher resolution, longer durations, and faster queues.",
    useCases: "funny video clips, memes, character animation, text to video, image to video, free daily credits",
    officialUrl: "https://hailuoai.video",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "openai-sora",
    name: "Sora",
    categorySlug: "video",
    shortDescription: "OpenAI's video model — free limited generations with sound in the Sora app.",
    description:
      "Sora is OpenAI's text-to-video model, generating clips with synchronized sound, convincing physics, and multi-shot storytelling. Sora 2 brought audio and better realism, and the app includes a free tier with daily limits so anyone can try it.",
    example:
      "Prompt “a paper boat sailing down a rainy street gutter, sound of rain” — Sora generates the clip complete with ambient audio.",
    freePlanLimits: "Free tier includes a daily allowance of generations with watermark and download limits; paid ChatGPT plans add higher resolutions, longer clips, and downloads.",
    useCases: "text to video, video with sound, storytelling clips, social content, openai, free video generation",
    officialUrl: "https://sora.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "google-veo",
    name: "Google Veo",
    categorySlug: "video",
    shortDescription: "Google's cinematic video model with native audio — limited free access via Gemini.",
    description:
      "Veo is Google's flagship video model, generating cinematic clips with native sound and strong prompt understanding. The fast variant is available in limited quantities to free Gemini users and more broadly in Google's Flow filmmaking tool for subscribers.",
    example:
      "In the Gemini app, ask Veo for “a timelapse of a city skyline at night with ambient street sounds” and get a short clip with audio.",
    freePlanLimits: "Limited free generations of Veo Fast in the Gemini app with daily caps and watermark; paid plans unlock more generations, Veo quality tiers, and the Flow filmmaking tool.",
    useCases: "cinematic video, video with audio, text to video, google, gemini video, short film clips",
    officialUrl: "https://labs.google/flow",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "capcut",
    name: "CapCut",
    categorySlug: "video",
    shortDescription: "Free full-featured video editor with AI captions, background removal, and effects.",
    description:
      "CapCut is a free video editor (desktop and mobile) from ByteDance packed with AI helpers: auto-captions, script-to-video, background removal, voice effects, and trendy templates. The free tier is genuinely usable for real content work — which is why it's everywhere on TikTok and YouTube Shorts.",
    example:
      "Drop in your raw vlog, hit “auto captions”, apply a template's beat-synced effects, and export in 4K — all on the free plan.",
    freePlanLimits: "Free plan includes most editing tools, auto-captions, and exports up to high resolution; Pro adds premium effects, cloud storage, and faster AI features.",
    useCases: "edit video, auto captions, tiktok editor, youtube shorts, remove background, free video editor, script to video",
    officialUrl: "https://www.capcut.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },

  // ------------------------------------------------------ Audio (new additions)
  {
    slug: "udio",
    name: "Udio",
    categorySlug: "audio",
    shortDescription: "AI music generator that creates full songs with vocals from a text prompt.",
    description:
      "Udio generates complete songs — verses, chorus, vocals, and instruments — from a description like “indie folk song about moving to the mountains”. You can extend tracks, remix sections, and steer style. A free tier lets you create daily.",
    example:
      "Type “dreamy synth-pop about late-night coding, female vocals” and get a 30-second snippet you can extend into a full track.",
    freePlanLimits: "Free tier includes a daily/monthly allowance of generations for personal listening; paid plans add commercial rights, downloads, and higher-quality exports.",
    useCases: "make a song, ai music, vocals, background music, custom birthday song, extend a track",
    officialUrl: "https://www.udio.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "stable-audio",
    name: "Stable Audio",
    categorySlug: "audio",
    shortDescription: "Stability AI's music and sound-effect generator with a free monthly credit plan.",
    description:
      "Stable Audio, from Stability AI, generates instrumental music, sound effects, and audio textures from text prompts — up to several minutes long. It's a favorite for sound design beds and loopable background tracks. The free plan renews with credits every month.",
    example:
      "Prompt “slow lo-fi beat with vinyl crackle, 60 seconds” for a loopable background track for your study video.",
    freePlanLimits: "Free plan includes 50 credits per month for non-commercial use; paid plans add commercial licensing and more credits.",
    useCases: "instrumental music, sound effects, background music, loops, sound design, royalty-free audio",
    officialUrl: "https://stableaudio.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "moises",
    name: "Moises",
    categorySlug: "audio",
    shortDescription: "AI music practice app that separates stems, changes pitch, and detects chords.",
    description:
      "Moises uses AI to split any song into its stems — vocals, drums, bass, guitar — so you can practice along, remix, or study parts. It also detects chords, changes key and speed without artifacts, and includes a metronome synced to the track. Made for musicians; free tier included.",
    example:
      "Upload a song, mute the guitar stem, and practice along with the band at 90% speed — Moises keeps pitch intact.",
    freePlanLimits: "Free plan includes a limited number of song uploads with basic stem separation; premium adds more uploads, instrument separation, and higher-quality exports.",
    useCases: "separate stems, remove vocals, practice guitar, change song key, slow down music, chord detection, karaoke track",
    officialUrl: "https://moises.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },
  {
    slug: "sonauto",
    name: "Sonauto",
    categorySlug: "audio",
    shortDescription: "Free unlimited AI music generator — no credits, no paywall between you and a song.",
    description:
      "Sonauto is an AI music generator that is currently free and unlimited: describe a song or feed it lyrics, pick a genre, and generate full tracks with vocals. Compared to credit-based rivals, its “no meter running” approach makes it the go-to for experimenting.",
    example:
      "Paste your own poem, choose “melancholic piano ballad”, and generate three different melodic settings — all free.",
    freePlanLimits: "Currently free with unlimited generations while in its early growth phase; a commercial-use license may require payment in the future.",
    useCases: "free ai music, unlimited music generation, song from lyrics, custom genre, free suno alternative",
    officialUrl: "https://sonauto.ai",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 9,
  },

  // ---------------------------------------------------- Research (new additions)
  {
    slug: "semantic-scholar",
    name: "Semantic Scholar",
    categorySlug: "research",
    shortDescription: "Free AI-powered search engine over 200 million academic papers.",
    description:
      "Semantic Scholar, from the Allen Institute for AI, is a completely free search engine for academic literature. It reads papers with AI to surface influential citations, TLDR summaries, and related work across 200+ million papers — no subscription, ever.",
    example:
      "Search “transformer architecture attention” and skim the AI-written TLDRs to find the three papers actually worth reading.",
    freePlanLimits: "Completely free, including search, TLDR summaries, citation graphs, and research feeds; a free API is available for developers.",
    useCases: "find papers, academic search, literature review, tldr summary, citation graph, free research tool",
    officialUrl: "https://www.semanticscholar.org",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },
  {
    slug: "scispace",
    name: "SciSpace",
    categorySlug: "research",
    shortDescription: "AI reader that explains complex papers paragraph by paragraph, with citations.",
    description:
      "SciSpace (formerly Typeset) helps you understand research papers: paste a PDF or search 280 million papers, then highlight any paragraph for a plain-English explanation. It also runs systematic literature reviews and paraphrases academic text. A free daily allowance keeps it useful without paying.",
    example:
      "Upload a dense machine-learning paper, highlight the math-heavy section, and get “explain this like I'm a grad student” instantly.",
    freePlanLimits: "Free plan includes a daily allowance of AI questions, paper explanations, and paraphrases; paid plans raise limits and add file uploads.",
    useCases: "explain a paper, understand research, literature review, academic paraphrasing, pdf reader, find papers",
    officialUrl: "https://typeset.io",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "researchrabbit",
    name: "ResearchRabbit",
    categorySlug: "research",
    shortDescription: "Discovers related papers visually — start with one paper, map the whole field.",
    description:
      "ResearchRabbit visualizes how papers connect. Add a seed paper and it builds an interactive map of related work, earlier/later citations, and similar studies — like a Spotify “Discover Weekly” for research. The core product is free for researchers.",
    example:
      "Add the one paper you already know, then click “similar work” to uncover eight more you'd never have found by keyword search.",
    freePlanLimits: "The core discovery and collection features are free; the team plans monetization around premium collaboration features.",
    useCases: "find related papers, literature mapping, citation discovery, research workflow, collections, free for researchers",
    officialUrl: "https://www.researchrabbit.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },
  {
    slug: "connected-papers",
    name: "Connected Papers",
    categorySlug: "research",
    shortDescription: "Turns one paper into a visual graph of its academic neighborhood.",
    description:
      "Connected Papers builds a similarity graph around any paper: nodes are papers that share citations and references, so you can see the field's structure at a glance and spot the key works you must read. Free users get a handful of visualizations each month.",
    example:
      "Paste a paper's DOI, get its graph, and screenshot the cluster of must-read papers radiating from it.",
    freePlanLimits: "Free plan includes 5 graph visualizations per month; paid plans add unlimited graphs, export options, and workspaces.",
    useCases: "visualize citations, find key papers, literature map, survey a field, similar papers, research graph",
    officialUrl: "https://www.connectedpapers.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 9,
  },

  // --------------------------------------------------- Education (new additions)
  {
    slug: "photomath",
    name: "Photomath",
    categorySlug: "education",
    shortDescription: "Scan any math problem with your camera and get instant step-by-step solutions.",
    description:
      "Photomath reads handwritten or printed math problems with your phone camera and solves them with clear, expandable steps — arithmetic through algebra, trigonometry, and calculus. The free tier shows solutions with basic steps, which is enough for most homework checks.",
    example:
      "Point your camera at question 7 on the worksheet, and tap through each solution step until the “aha” lands.",
    freePlanLimits: "Free tier includes scanning and full solutions with basic step-by-step explanations; Plus unlocks deeper explanations and how-to tips for each step.",
    useCases: "solve math, homework help, step by step, scan a problem, algebra, calculus, check my work",
    officialUrl: "https://photomath.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "gauth",
    name: "Gauth",
    categorySlug: "education",
    shortDescription: "AI homework helper for all subjects — photo in, worked solution out.",
    description:
      "Gauth (formerly Gauthmath) covers math, physics, chemistry, biology, and more: snap a photo of the problem and an AI tutor works through the solution, with live human experts as backup for the tricky ones. A free daily allowance keeps casual use free.",
    example:
      "Photograph your chemistry stoichiometry worksheet and get each problem worked out with the reasoning shown.",
    freePlanLimits: "Free tier includes a daily allowance of AI solutions with some ads; Plus removes limits and ads and adds expert priority.",
    useCases: "homework help, all subjects, solve chemistry, physics help, photo solver, ai tutor",
    officialUrl: "https://www.gauthmath.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "magicschool-ai",
    name: "MagicSchool AI",
    categorySlug: "education",
    shortDescription: "80+ AI tools built for teachers — lesson plans, rubrics, and feedback in minutes.",
    description:
      "MagicSchool is an AI platform designed with teachers, for teachers: lesson plan generators, standards-aligned quizzes, rubric builders, IEP suggestions, and student feedback tools — over 80 purpose-built helpers. It's COPPA/FERPA-aligned and wildly popular in schools. A solid free tier exists for individual teachers.",
    example:
      "Pick “5E lesson plan”, enter your grade and topic, and get a complete plan with materials and differentiation in under a minute.",
    freePlanLimits: "Free plan includes a generous monthly allowance across the 80+ teacher tools; paid plans add unlimited usage, student tools (Raina), and district features.",
    useCases: "lesson plan, rubric generator, quiz maker, teacher tools, feedback comments, iep support, worksheet",
    officialUrl: "https://www.magicschool.ai",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "duolingo",
    name: "Duolingo",
    categorySlug: "education",
    shortDescription: "The free gamified language app, now with AI conversation practice.",
    description:
      "Duolingo remains the most popular way to start a language for free — bite-sized gamified lessons in 40+ languages. AI now powers the personalization, mistakes review, and (on paid Max) open-ended video-call practice with an AI character. The free tier is a complete course, not a demo.",
    example:
      "Complete one five-minute Spanish lesson per streak-day, and let the AI-driven review queue resurface exactly the words you keep flubbing.",
    freePlanLimits: "Free plan includes the full course with ads and hearts (mistake limits); Super removes ads/limits and Max adds AI conversation practice.",
    useCases: "learn a language, spanish, french, practice conversation, gamified learning, daily streak, free course",
    officialUrl: "https://www.duolingo.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 3,
  },

  // -------------------------------------------------- Automation (new additions)
  {
    slug: "ifttt",
    name: "IFTTT",
    categorySlug: "automation",
    shortDescription: "The original if-this-then-that automation — simple applets, free plan included.",
    description:
      "IFTTT connects 1,000+ apps with simple one-trigger-one-action “applets” — save Instagram posts to Dropbox, text yourself when it rains, sync calendars. It's the easiest automation tool to learn, and the free plan covers a handful of personal automations.",
    example:
      "Enable the “if I'm tagged in a Facebook photo, save it to Google Drive” applet and never manually download a photo again.",
    freePlanLimits: "Free plan includes a monthly allowance of runs across a limited number of active applets; paid plans add more applets, faster queries, and multi-step actions.",
    useCases: "simple automation, connect apps, smart home, social media backup, applets, no code",
    officialUrl: "https://ifttt.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 7,
  },
  {
    slug: "activepieces",
    name: "Activepieces",
    categorySlug: "automation",
    shortDescription: "Open-source Zapier alternative with a generous free cloud tier.",
    description:
      "Activepieces is the friendliest open-source automation tool: a clean builder, hundreds of integrations, and AI-assisted flow creation. Run it free on their cloud with multiple active flows, or self-host the MIT-licensed community edition with no limits at all.",
    example:
      "Build a flow: new RSS article → AI summary → post to your team's Slack channel, generated for you from a one-line description.",
    freePlanLimits: "Free cloud plan includes multiple active flows with a monthly task allowance; the community edition is open source (MIT) and free to self-host with unlimited runs.",
    useCases: "zapier alternative, open source automation, self host, ai workflow builder, connect apps, no code",
    officialUrl: "https://www.activepieces.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 5,
  },
  {
    slug: "flowise",
    name: "Flowise",
    categorySlug: "automation",
    shortDescription: "Drag-and-drop builder for LLM apps, chatbots, and AI agents — open source.",
    description:
      "Flowise is an open-source visual builder for AI workflows: drag nodes for LLMs, document loaders, vector stores, and tools to assemble chatbots, RAG pipelines, and multi-step agents without writing code. Self-host it free, or use the managed cloud.",
    example:
      "Drag in a PDF loader, a vector store, and a chat model, connect them, and publish a chatbot that answers questions about your handbook.",
    freePlanLimits: "Open source and free to self-host with unlimited flows; the managed cloud offers paid plans with a limited free tier.",
    useCases: "build a chatbot, rag pipeline, ai agents, no code ai, drag and drop, llm workflow, open source",
    officialUrl: "https://flowiseai.com",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 8,
  },

  // ------------------------------------------------- Productivity (new category)
  {
    slug: "gamma",
    name: "Gamma",
    categorySlug: "productivity",
    shortDescription: "Type an outline, get a beautiful interactive presentation — no design skills needed.",
    description:
      "Gamma turns a prompt or outline into a polished, web-native presentation, document, or mini-site in a couple of minutes — with smart layouts, images, and charts included. Decks live on the web, embed anything, and are far easier to restyle than slides. A free tier with starter credits makes it one of the best free AI tools right now.",
    example:
      "Paste your talk outline into Gamma, pick a theme, and get an 8-card deck with visuals you can edit by chatting with it.",
    freePlanLimits: "Free plan includes starter credits (400 at signup) with a small monthly refill, AI edits, and unlimited shared decks; paid plans remove branding and add exports and credits.",
    useCases: "make a presentation, pitch deck, ai slides, quick website, one pager, school project, outline to deck",
    officialUrl: "https://gamma.app",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 1,
  },
  {
    slug: "fathom",
    name: "Fathom",
    categorySlug: "productivity",
    shortDescription: "Free AI notetaker for Zoom, Meet, and Teams — unlimited meetings on the free plan.",
    description:
      "Fathom joins your video calls, records them, and delivers an AI summary with action items and highlighted quotes moments after you hang up. Unlike most notetakers, the free plan is genuinely unlimited for individuals, which has made it hugely popular with sales and consulting teams.",
    example:
      "Let Fathom sit in on your client call; by the time you're back in your inbox, a summary with decisions and follow-ups is ready to forward.",
    freePlanLimits: "Free plan includes unlimited AI meeting summaries, action items, and sync to CRMs for individuals; paid team plans add team feeds, playlists, and admin controls.",
    useCases: "meeting notes, ai notetaker, zoom summary, action items, call transcription, free unlimited notes",
    officialUrl: "https://fathom.video",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 2,
  },
  {
    slug: "tldv",
    name: "tl;dv",
    categorySlug: "productivity",
    shortDescription: "Records, transcribes, and summarizes meetings across Zoom, Meet, and Teams.",
    description:
      "tl;dv is an AI meeting recorder that transcribes in 30+ languages, generates timestamped summaries, and lets you clip and share key moments. It integrates with Notion, Slack, and CRMs, and the free plan covers unlimited recordings with core AI features.",
    example:
      "Tag the moment your client approved the budget, then send the 40-second clip with transcript to whoever missed the call.",
    freePlanLimits: "Free plan includes unlimited recordings and transcriptions with basic AI summaries; paid plans add advanced insights, more AI features, and team workspaces.",
    useCases: "record meetings, ai summary, transcript, clip sharing, zoom, google meet, multilingual transcription",
    officialUrl: "https://tldv.io",
    pricingModel: "FREEMIUM",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 6,
  },
  {
    slug: "napkin-ai",
    name: "Napkin AI",
    categorySlug: "productivity",
    shortDescription: "Turns plain text into professional diagrams and visuals in one click.",
    description:
      "Napkin AI converts any text — a blog post, a process description, meeting notes — into clean, editable visuals: flowcharts, timelines, comparison graphics, and concept illustrations styled like a designer made them. It's become the fastest way to make boring documents look professional, and it's free to start.",
    example:
      "Paste your article's “three ways to validate an idea” section and get a polished visual you can export as SVG or PNG.",
    freePlanLimits: "Free plan includes a limited number of documents and visuals per month with the core styles; paid plans add brand kits, more exports, and collaboration.",
    useCases: "text to visual, diagram, flowchart, infographic, business illustration, make documents visual, free design tool",
    officialUrl: "https://www.napkin.ai",
    pricingModel: "FREE",
    hasFreeTrial: false,
    trialNote: "",
    checkedDaysAgo: 4,
  },
  {
    slug: "notion-ai",
    name: "Notion AI",
    categorySlug: "productivity",
    shortDescription: "AI writing, search, and database autopilot built into your Notion workspace.",
    description:
      "Notion AI adds a layer of AI across your whole workspace: it drafts and edits documents, answers questions by searching your wiki and connected apps, auto-fills database properties, and summarizes pages. Included in Business and Enterprise plans; available as an add-on for others with a free trial.",
    example:
      "Ask Notion AI “what did the team decide about the pricing page last month?” and get an answer sourced from your meeting notes and docs.",
    freePlanLimits: "",
    useCases: "workspace search, ai writing, summarize docs, database autofill, meeting notes, knowledge management",
    officialUrl: "https://www.notion.so/product/ai",
    pricingModel: "PAID",
    hasFreeTrial: true,
    trialNote: "Free trial available; included at no extra cost in Business and Enterprise plans",
    checkedDaysAgo: 8,
  },
];

async function main() {
  console.log("Seeding ai tools central catalog…");

  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const category = await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, description: c.description },
      create: c,
    });
    categoryIds.set(c.slug, category.id);
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`);

  for (const t of TOOLS) {
    const categoryId = categoryIds.get(t.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug: ${t.categorySlug}`);

    const data = {
      name: t.name,
      shortDescription: t.shortDescription,
      description: t.description,
      example: t.example,
      freePlanLimits: t.freePlanLimits,
      useCases: t.useCases,
      officialUrl: t.officialUrl,
      pricingModel: t.pricingModel,
      hasFreeTrial: t.hasFreeTrial,
      trialNote: t.trialNote,
      pricingLastChecked: daysAgo(t.checkedDaysAgo),
      status: "PUBLISHED",
      categoryId,
    };

    await db.tool.upsert({
      where: { slug: t.slug },
      update: data,
      create: { ...data, slug: t.slug },
    });
  }
  console.log(`  ✓ ${TOOLS.length} published tools`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
