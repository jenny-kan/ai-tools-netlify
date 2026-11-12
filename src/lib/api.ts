import type {
  AdminBlogOverviewDTO,
  AnalyticsDashboardResponse,
  BlogListResponse,
  BlogPostDTO,
  BlogPostInput,
  BlogPostDetailResponse,
  BlogPostSummary,
  BloggerLoginResponse,
  BloggerSignupPayload,
  CategoryDTO,
  CategoryInput,
  ContactMessageDTO,
  ContactPayload,
  DonationDTO,
  DonationPayload,
  DonationsAdminResponse,
  ImportFormat,
  ImportRunRequestDTO,
  ImportRunResponseDTO,
  MessageStatus,
  ParseImportResponse,
  SystemStatusDTO,
  ToolDTO,
  ToolDetailResponse,
  ToolInput,
  ToolStatus,
} from "./types";

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const message = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

// ------------------------------------------------------------------ public

export interface PublicToolQuery {
  q?: string;
  category?: string;
  pricing?: string;
  trial?: boolean;
}

export async function getPublicTools(params: PublicToolQuery = {}): Promise<ToolDTO[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category && params.category !== "all") search.set("category", params.category);
  if (params.pricing && params.pricing !== "all") search.set("pricing", params.pricing);
  if (params.trial) search.set("trial", "1");
  const qs = search.toString();
  return request<ToolDTO[]>(`/api/tools${qs ? `?${qs}` : ""}`);
}

export async function getToolDetail(slug: string): Promise<ToolDetailResponse> {
  return request<ToolDetailResponse>(`/api/tools/${encodeURIComponent(slug)}`);
}

export async function getCategories(): Promise<CategoryDTO[]> {
  return request<CategoryDTO[]>("/api/categories");
}

// ------------------------------------------------------------------ contact

export interface ContactChallengeResponse {
  question: string;
  token: string;
}

export async function getContactChallenge(): Promise<ContactChallengeResponse> {
  return request<ContactChallengeResponse>("/api/contact/challenge");
}

export async function submitContactMessage(payload: ContactPayload): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ------------------------------------------------------------------ admin: messages

export async function getAdminMessages(): Promise<ContactMessageDTO[]> {
  return request<ContactMessageDTO[]>("/api/admin/messages");
}

export async function setMessageStatus(
  id: string,
  status: MessageStatus
): Promise<ContactMessageDTO> {
  return request<ContactMessageDTO>(`/api/admin/messages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteMessage(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/messages/${id}`, { method: "DELETE" });
}

export interface ReplyResponse {
  message: ContactMessageDTO;
  delivered: boolean;
  dryRun: boolean;
}

/** Send the admin's email reply server-side (Resend API — never a mailto:). */
export async function replyToMessage(id: string, reply: string): Promise<ReplyResponse> {
  return request<ReplyResponse>(`/api/admin/messages/${id}/reply`, {
    method: "POST",
    body: JSON.stringify({ reply }),
  });
}

// ------------------------------------------------------------------ admin: session

export async function getAdminSession(): Promise<{
  authenticated: boolean;
  disabled?: boolean;
  demoPassword?: string;
}> {
  return request<{ authenticated: boolean; disabled?: boolean; demoPassword?: string }>("/api/admin/session");
}

/** Deployment diagnostics — powers the System status banner in the dashboard. */
export async function getSystemStatus(): Promise<SystemStatusDTO> {
  return request<SystemStatusDTO>("/api/admin/system-status");
}

export async function adminLogin(password: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminLogout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/admin/logout", { method: "POST" });
}

// ------------------------------------------------------------------ admin: tools

export interface AdminToolSaveResult {
  tool: ToolDTO;
  duplicates: ToolDTO[];
}

export async function getAdminTools(): Promise<ToolDTO[]> {
  return request<ToolDTO[]>("/api/admin/tools");
}

export async function createTool(input: ToolInput): Promise<AdminToolSaveResult> {
  return request<AdminToolSaveResult>("/api/admin/tools", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTool(id: string, input: ToolInput): Promise<AdminToolSaveResult> {
  return request<AdminToolSaveResult>(`/api/admin/tools/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function setToolStatus(id: string, status: ToolStatus): Promise<{ tool: ToolDTO }> {
  return request<{ tool: ToolDTO }>(`/api/admin/tools/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteTool(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/tools/${id}`, { method: "DELETE" });
}

export async function checkDuplicates(params: {
  name?: string;
  url?: string;
  excludeId?: string;
}): Promise<ToolDTO[]> {
  const search = new URLSearchParams();
  if (params.name) search.set("name", params.name);
  if (params.url) search.set("url", params.url);
  if (params.excludeId) search.set("excludeId", params.excludeId);
  const qs = search.toString();
  return request<ToolDTO[]>(`/api/admin/duplicates${qs ? `?${qs}` : ""}`);
}

// ------------------------------------------------------------------ admin: bulk import

/** Parse an uploaded import file (multipart). For SQLite with multiple tables,
 *  the response asks for a table to be picked — re-send the same file with `table`. */
export async function parseImportFile(
  file: File,
  opts: { format?: ImportFormat; table?: string } = {}
): Promise<ParseImportResponse> {
  const form = new FormData();
  form.append("file", file);
  if (opts.format) form.append("format", opts.format);
  if (opts.table) form.append("table", opts.table);
  const res = await fetch("/api/admin/import/parse", { method: "POST", body: form });
  return unwrap(res);
}

/** Parse pasted CSV/TSV/JSON text. */
export async function parseImportText(text: string, format: ImportFormat): Promise<ParseImportResponse> {
  const res = await fetch("/api/admin/import/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, format }),
  });
  return unwrap(res);
}

/** Dry-run validate or actually execute a bulk import. */
export async function runImport(payload: ImportRunRequestDTO): Promise<ImportRunResponseDTO> {
  return request<ImportRunResponseDTO>("/api/admin/import/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function unwrap(res: Response): Promise<ParseImportResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const message = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }
  return body as ParseImportResponse;
}

// ------------------------------------------------------------------ admin: categories

export async function getAdminCategories(): Promise<CategoryDTO[]> {
  return request<CategoryDTO[]>("/api/admin/categories");
}

export async function createCategory(input: CategoryInput): Promise<CategoryDTO> {
  return request<CategoryDTO>("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCategory(id: string, input: CategoryInput): Promise<CategoryDTO> {
  return request<CategoryDTO>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteCategory(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/categories/${id}`, { method: "DELETE" });
}

// ------------------------------------------------------------------ blog: public

export async function getBlogPosts(params: { q?: string; tag?: string } = {}): Promise<BlogListResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.tag) search.set("tag", params.tag);
  const qs = search.toString();
  return request<BlogListResponse>(`/api/blog${qs ? `?${qs}` : ""}`);
}

export async function getBlogPost(slug: string): Promise<BlogPostDetailResponse> {
  return request<BlogPostDetailResponse>(`/api/blog/${encodeURIComponent(slug)}`);
}

// ------------------------------------------------------------------ blog: auth

export async function bloggerSignup(payload: BloggerSignupPayload): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>("/api/blog/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function bloggerLogin(email: string, password: string): Promise<BloggerLoginResponse> {
  return request<BloggerLoginResponse>("/api/blog/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function bloggerLogout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/blog/auth/logout", { method: "POST" });
}

/** Ask for a password-reset email. Response is enumeration-safe (identical
 *  whether or not the email is registered). In dry-run mode (no RESEND_API_KEY)
 *  the server also returns `resetUrl` so the demo flow can continue. */
export async function requestBloggerPasswordReset(
  email: string
): Promise<{ ok: boolean; message: string; dryRun?: boolean; resetUrl?: string }> {
  return request<{ ok: boolean; message: string; dryRun?: boolean; resetUrl?: string }>(
    "/api/blog/auth/forgot-password",
    { method: "POST", body: JSON.stringify({ email }) }
  );
}

/** Complete a password reset with the emailed token. */
export async function resetBloggerPassword(
  token: string,
  password: string
): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>("/api/blog/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

/** Returns the signed-in blogger, or { authenticated: false }. */
export async function getBloggerSession(): Promise<
  { authenticated: true; blogger: NonNullable<BloggerLoginResponse["blogger"]> } | { authenticated: false }
> {
  return request<{ authenticated: true; blogger: NonNullable<BloggerLoginResponse["blogger"]> } | { authenticated: false }>(
    "/api/blog/auth/session"
  );
}

// ------------------------------------------------------------------ blog: author

/** Full DTOs including content — the author's own posts endpoint returns them complete. */
export async function getMyPosts(): Promise<BlogPostDTO[]> {
  return request<BlogPostDTO[]>("/api/blog/author/posts");
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogPostDTO> {
  return request<BlogPostDTO>("/api/blog/author/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<BlogPostDTO> {
  return request<BlogPostDTO>(`/api/blog/author/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function submitBlogPost(id: string): Promise<BlogPostDTO> {
  return request<BlogPostDTO>(`/api/blog/author/posts/${id}/submit`, { method: "POST" });
}

export async function deleteBlogPost(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/blog/author/posts/${id}`, { method: "DELETE" });
}

// ------------------------------------------------------------------ admin: blog

export async function getAdminBlogOverview(): Promise<AdminBlogOverviewDTO> {
  return request<AdminBlogOverviewDTO>("/api/admin/blog/overview");
}

export async function decideApplication(
  id: string,
  action: "approve" | "reject",
  note = ""
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/blog/applications/${id}`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });
}

export async function reviewBlogPost(
  id: string,
  action: "publish" | "reject" | "unpublish",
  note = ""
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/blog/posts/${id}`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });
}

// ------------------------------------------------------------------ donations

export async function createDonation(payload: DonationPayload): Promise<DonationDTO> {
  return request<DonationDTO>("/api/donations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Demo-mode payment simulation — marks a pending donation as completed. */
export async function confirmDonation(id: string): Promise<DonationDTO> {
  return request<DonationDTO>(`/api/donations/${id}/confirm`, { method: "POST" });
}

export async function getAdminDonations(): Promise<DonationsAdminResponse> {
  return request<DonationsAdminResponse>("/api/admin/donations");
}

// ------------------------------------------------------------------ analytics

/** Fire-and-forget page-view beacon (privacy-friendly, no PII). */
export function trackPageView(payload: { path: string; referrer: string; sessionId: string; toolSlug?: string }): void {
  void fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export async function getAdminAnalytics(): Promise<AnalyticsDashboardResponse> {
  return request<AnalyticsDashboardResponse>("/api/admin/analytics");
}
