import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/security";

/**
 * Server-side blogger session management.
 *
 * Security model:
 *  - Raw 256-bit token lives only in an httpOnly, sameSite=lax cookie.
 *  - Only the SHA-256 hash of the token is stored in the database, so a DB
 *    leak cannot be replayed as a valid session.
 *  - Sessions expire after 7 days and are deleted on logout.
 */

export const BLOGGER_COOKIE = "atf_blogger";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionBlogger {
  id: string;
  email: string;
  name: string;
  bio: string;
  status: string;
}

/** Create a DB-backed session for a blogger; returns the raw cookie token. */
export async function createBloggerSession(bloggerId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.bloggerSession.create({
    data: {
      tokenHash: sha256(token),
      bloggerId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

/** Resolve the current blogger from the session cookie, or null. */
export async function getSessionBlogger(): Promise<SessionBlogger | null> {
  const store = await cookies();
  const token = store.get(BLOGGER_COOKIE)?.value;
  if (!token) return null;

  const session = await db.bloggerSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { blogger: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.bloggerSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const b = session.blogger;
  return { id: b.id, email: b.email, name: b.name, bio: b.bio, status: b.status };
}

/** Delete the current session (logout). Safe to call when not signed in. */
export async function destroyBloggerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(BLOGGER_COOKIE)?.value;
  if (token) {
    await db.bloggerSession.deleteMany({ where: { tokenHash: sha256(token) } }).catch(() => undefined);
  }
}

export function bloggerUnauthorized(): Response {
  return Response.json({ error: "Sign in to your blogger account first." }, { status: 401 });
}
