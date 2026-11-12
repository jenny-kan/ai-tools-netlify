import { sanitizeText } from "@/lib/security";

/**
 * Transactional email via Resend's REST API (https://resend.com).
 *
 * Why Resend? Free tier (3,000 emails/month, 100/day), a single HTTPS call
 * with an API key — no SMTP daemon, no SDK dependency. Configure with:
 *   RESEND_API_KEY=re_xxx            (required for real delivery)
 *   RESEND_FROM="AI Tool Finder <noreply@yourdomain.com>"
 *   CONTACT_REPLY_TO=editor@yourdomain.com   (Reply-To header, optional)
 *
 * Without RESEND_API_KEY the module runs in "dry-run" mode: the reply is
 * validated, recorded and audited exactly like a real send, but no email
 * leaves the server. This keeps the demo fully functional and testable.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailResult {
  /** true when the provider accepted the message. */
  delivered: boolean;
  /** true when no API key was configured — nothing was sent. */
  dryRun: boolean;
  /** Provider message id ("" for dry runs). */
  emailId: string;
  /** Human-readable status for audit logs / admin toasts. */
  detail: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/** Single-line sanitization — blocks CR/LF header-injection (OWASP A03). */
function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n\u0000-\u001F\u007F]/g, " ").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validate + normalize the fields that become SMTP headers. */
export function validateOutgoingEmail(email: OutgoingEmail): { ok: true } | { ok: false; error: string } {
  if (!EMAIL_RE.test(email.to)) return { ok: false, error: "The recipient address is not a valid email." };
  if (email.replyTo && !EMAIL_RE.test(email.replyTo)) {
    return { ok: false, error: "The Reply-To address is not a valid email." };
  }
  const subject = stripHeaderInjection(email.subject);
  if (subject.length < 3 || subject.length > 200) {
    return { ok: false, error: "Subject must be between 3 and 200 characters." };
  }
  const text = email.text.trim();
  if (text.length < 10) return { ok: false, error: "The reply is too short — write at least 10 characters." };
  if (text.length > 5000) return { ok: false, error: "The reply must be under 5,000 characters." };
  return { ok: true };
}

/** Plain-text body with a soft wrap so 80-char terminals read nicely. */
function wrapText(text: string, width = 72): string {
  return text
    .split("\n")
    .map((line) =>
      line.length <= width
        ? line
        : (line.match(new RegExp(`.{1,${width}}(\\s|$)`, "g")) ?? [line]).join("\n")
    )
    .join("\n");
}

/** Append the standard footer (unsubscribe-by-replying + privacy note). */
function withFooter(text: string): string {
  return `${wrapText(text)}

— The AI Tool Finder editors
https://ai-tool-finder.app

You received this email because you wrote to AI Tool Finder via the
contact form. Reply to this email and a human editor will read it.`;
}

export function isEmailDryRun(): boolean {
  return !process.env.RESEND_API_KEY;
}

export function senderAddress(): string {
  return (
    process.env.RESEND_FROM ??
    "AI Tool Finder <onboarding@resend.dev>"
  );
}

/**
 * Send (or dry-run) a transactional email. Never throws — callers get a
 * structured result and decide how to surface it (OWASP A09-friendly).
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  const subject = stripHeaderInjection(email.subject);
  const text = withFooter(sanitizeText(email.text));

  if (!apiKey) {
    console.info(
      `[email:dry-run] to=<${email.to}> subject="${subject}" (${text.length} chars) — ` +
        `set RESEND_API_KEY to deliver for real.`
    );
    return { delivered: false, dryRun: true, emailId: "", detail: "Dry run — no RESEND_API_KEY configured." };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderAddress(),
        to: [email.to],
        subject,
        text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      // Tight timeouts so a slow provider can't hang an admin request.
      signal: AbortSignal.timeout(10_000),
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (typeof body === "object" && body !== null && "message" in body
          ? String((body as Record<string, unknown>).message)
          : `HTTP ${res.status}`) || `HTTP ${res.status}`;
      console.error(`[email] Resend rejected the send: ${msg}`);
      return { delivered: false, dryRun: false, emailId: "", detail: `Provider rejected the email: ${msg}` };
    }

    const emailId =
      typeof body === "object" && body !== null && "id" in body
        ? String((body as Record<string, unknown>).id)
        : "";
    return { delivered: true, dryRun: false, emailId, detail: "Delivered via Resend." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    console.error(`[email] send failed: ${msg}`);
    return { delivered: false, dryRun: false, emailId: "", detail: `Email provider unreachable: ${msg}` };
  }
}
