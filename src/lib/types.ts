export type PricingModel = "FREE" | "FREEMIUM" | "PAID";
export type ToolStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const PRICING_MODELS: PricingModel[] = ["FREE", "FREEMIUM", "PAID"];
export const TOOL_STATUSES: ToolStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export const PRICING_LABELS: Record<PricingModel, string> = {
  FREE: "Free",
  FREEMIUM: "Freemium",
  PAID: "Paid",
};

export const STATUS_LABELS: Record<ToolStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export interface CategoryLite {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface CategoryDTO extends CategoryLite {
  description: string;
  toolCount: number;
}

export interface ToolDTO {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  example: string;
  freePlanLimits: string;
  useCases: string;
  officialUrl: string;
  pricingModel: PricingModel;
  hasFreeTrial: boolean;
  trialNote: string;
  /** ISO date string */
  pricingLastChecked: string;
  status: ToolStatus;
  categoryId: string;
  category?: CategoryLite;
  /** ISO date strings */
  createdAt: string;
  updatedAt: string;
}

export interface ToolDetailResponse {
  tool: ToolDTO;
  related: ToolDTO[];
}

/** Payload used when creating or updating a tool via the admin API. */
export interface ToolInput {
  name: string;
  shortDescription: string;
  description: string;
  example: string;
  freePlanLimits: string;
  useCases: string;
  officialUrl: string;
  pricingModel: PricingModel | "";
  hasFreeTrial: boolean;
  trialNote: string;
  pricingLastChecked: string;
  categoryId: string;
  status: ToolStatus;
}

export interface CategoryInput {
  name: string;
  description: string;
  icon: string;
}

// ------------------------------------------------------------------ contact

export type ContactReason = "FEEDBACK" | "ISSUE" | "SUGGESTION" | "TOOL_SUGGESTION" | "OTHER";
export type MessageStatus = "NEW" | "READ" | "ARCHIVED";

export const CONTACT_REASON_LABELS: Record<ContactReason, string> = {
  FEEDBACK: "Feedback",
  ISSUE: "Report an issue",
  SUGGESTION: "Suggestion",
  TOOL_SUGGESTION: "Suggest an AI tool",
  OTHER: "Something else",
};

export interface ContactMessageDTO {
  id: string;
  name: string;
  email: string;
  reason: ContactReason;
  subject: string;
  message: string;
  toolName: string;
  toolUrl: string;
  status: MessageStatus;
  /** ISO date strings (null = never replied) */
  repliedAt: string | null;
  replyText: string;
  /** ISO date strings */
  createdAt: string;
  updatedAt: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  reason: ContactReason;
  subject: string;
  message: string;
  toolName: string;
  toolUrl: string;
  website: string; // honeypot — must stay empty
  loadedAt: number; // timestamp when the form page was opened
  challengeToken: string;
  challengeAnswer: string;
}

// ------------------------------------------------------------------ bulk import

export type ImportFormat = "csv" | "tsv" | "json" | "sqlite";

/** Tool fields that a bulk-import source column can be mapped to. */
export const IMPORT_FIELDS = [
  "name",
  "categoryName",
  "shortDescription",
  "officialUrl",
  "pricingModel",
  "status",
  "description",
  "example",
  "freePlanLimits",
  "useCases",
  "hasFreeTrial",
  "trialNote",
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  name: "Name",
  categoryName: "Category",
  shortDescription: "Short description",
  officialUrl: "Official URL",
  pricingModel: "Pricing model",
  status: "Status",
  description: "Full description",
  example: "Example prompt",
  freePlanLimits: "Free plan limits",
  useCases: "Use cases",
  hasFreeTrial: "Free trial",
  trialNote: "Trial note",
};

/** A parsed bulk-import source: raw rows keyed by original column header. */
export interface ParsedImportDTO {
  format: ImportFormat;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
  warnings: string[];
}

export interface SqliteTableInfoDTO {
  name: string;
  rowCount: number;
  columns: string[];
}

/** Response of the parse endpoint — either parsed rows or a table picker for SQLite. */
export interface ParseImportResponse extends Partial<ParsedImportDTO> {
  needsTable?: boolean;
  tables?: SqliteTableInfoDTO[];
  /** Server-suggested field → column mapping based on header aliases. */
  suggestedMapping?: Partial<Record<ImportFieldKey, string>>;
}

export interface ImportOptionsDTO {
  /** Status used when a row doesn't provide one (or provides an unknown value). */
  defaultStatus: ToolStatus;
  defaultPricingModel: PricingModel;
  /** Fallback category id when a row has no (resolvable) category. "" = none. */
  defaultCategoryId: string;
  skipDuplicates: boolean;
  autoCreateCategories: boolean;
}

export interface ImportRunRequestDTO {
  rows: Record<string, string>[];
  mapping: Partial<Record<ImportFieldKey, string>>;
  options: ImportOptionsDTO;
  dryRun: boolean;
}

export interface ImportRowResultDTO {
  /** 0-based index into the submitted rows array. */
  index: number;
  name: string;
  status: "ok" | "error";
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  /** Name of the existing tool this row duplicates. */
  duplicateOfName?: string;
  duplicateOfId?: string;
  /** Set when this row duplicates an earlier row in the same batch. */
  duplicateInBatch?: number;
  category: string;
  pricing: string;
  finalStatus: ToolStatus;
  created: boolean;
  /** Runtime failure message when the row couldn't be written. */
  failedReason?: string;
}

export interface ImportRunResponseDTO {
  dryRun: boolean;
  summary: {
    total: number;
    /** Rows that were (or would be) written to the database. */
    importable: number;
    duplicates: number;
    errors: number;
    created: number;
    skippedDuplicates: number;
    failed: number;
    categoriesCreated: { name: string; slug: string }[];
  };
  rows: ImportRowResultDTO[];
}

export function isPricingModel(value: unknown): value is PricingModel {
  return typeof value === "string" && (PRICING_MODELS as string[]).includes(value);
}

export function isToolStatus(value: unknown): value is ToolStatus {
  return typeof value === "string" && (TOOL_STATUSES as string[]).includes(value);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

// ------------------------------------------------------------------ blog

export type BloggerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type BlogPostStatus = "DRAFT" | "SUBMITTED" | "PUBLISHED" | "REJECTED";

export const BLOGGER_STATUSES: BloggerStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
export const BLOG_POST_STATUSES: BlogPostStatus[] = ["DRAFT", "SUBMITTED", "PUBLISHED", "REJECTED"];

export const BLOGGER_STATUS_LABELS: Record<BloggerStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export const BLOG_POST_STATUS_LABELS: Record<BlogPostStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "In review",
  PUBLISHED: "Published",
  REJECTED: "Changes requested",
};

/** Public-safe blogger info (never exposes hash/login internals). */
export interface BloggerLite {
  id: string;
  name: string;
  bio: string;
}

export interface BlogPostDTO {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[]; // parsed from the comma-separated DB field
  status: BlogPostStatus;
  reviewNote: string;
  author: BloggerLite;
  /** ISO date strings (null while unpublished) */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Blog list items omit content for payload size. */
export type BlogPostSummary = Omit<BlogPostDTO, "content">;

export interface BlogListResponse {
  posts: BlogPostSummary[];
  total: number;
}

export interface BlogPostDetailResponse {
  post: BlogPostDTO;
  related: BlogPostSummary[];
}

/** Payload for creating/updating a post as a blogger. */
export interface BlogPostInput {
  title: string;
  excerpt: string;
  content: string;
  tags: string[]; // max 5, each ≤ 24 chars
}

/** Signup/application payload (password ≥ 20 chars, server-verified). */
export interface BloggerSignupPayload {
  name: string;
  email: string;
  password: string;
  bio: string;
  applicationReason: string;
  writingSample: string;
}

export interface BloggerLoginResponse {
  blogger: { id: string; name: string; email: string; status: BloggerStatus };
}

/** Admin view of an application (includes moderation fields). */
export interface BloggerApplicationDTO {
  id: string;
  name: string;
  email: string;
  bio: string;
  status: BloggerStatus;
  applicationReason: string;
  writingSample: string;
  reviewNote: string;
  appliedAt: string;
  decidedAt: string | null;
}

export interface AdminBlogOverviewDTO {
  applications: BloggerApplicationDTO[];
  /** Full posts including content — admins review the markdown before publishing. */
  posts: BlogPostDTO[];
}

// --------------------------------------------------------- system diagnostics

/** GET /api/admin/system-status — deployment health for the admin banner. */
export interface SystemStatusDTO {
  database: {
    connected: boolean;
    schemaReady: boolean;
    missingTables: string[];
    error: string | null;
    counts: { tools: number; published: number; categories: number } | null;
  };
  environment: {
    node: string;
    host: "netlify" | "vercel" | "self-hosted";
  };
  time: string;
}

// -------------------------------------------------------------- donations

export type DonationStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export const DONATION_STATUSES: DonationStatus[] = ["PENDING", "COMPLETED", "CANCELLED"];

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export interface DonationDTO {
  id: string;
  donorName: string;
  email: string;
  amountCents: number;
  currency: string;
  message: string;
  status: DonationStatus;
  provider: string;
  createdAt: string;
}

export interface DonationPayload {
  donorName: string;
  email: string;
  amountCents: number;
  message: string;
}

export interface DonationsAdminResponse {
  donations: DonationDTO[];
  totals: { completedCount: number; completedCents: number; pendingCount: number };
}

// -------------------------------------------------------------- analytics

export interface AnalyticsDailyPoint {
  /** YYYY-MM-DD */
  date: string;
  views: number;
}

export interface AnalyticsTopEntry {
  key: string;
  label: string;
  views: number;
}

export interface AnalyticsResponse {
  totals: {
    views: number;
    sessions: number;
    views7d: number;
    views30d: number;
    viewsToday: number;
  };
  daily: AnalyticsDailyPoint[]; // last 14 days
  topPages: AnalyticsTopEntry[];
  topReferrers: AnalyticsTopEntry[];
  topTools: AnalyticsTopEntry[];
}

export interface AuditEntryDTO {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  details: string;
  ip: string;
  createdAt: string;
}

export interface AnalyticsDashboardResponse extends AnalyticsResponse {
  recentAudit: AuditEntryDTO[];
}
