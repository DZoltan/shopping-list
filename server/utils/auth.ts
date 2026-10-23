import type { H3Event } from 'h3'
import type { User } from '#auth-utils'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { authChallenges, users } from '../db/schema'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

// --- sessions ---

// The session cookie is sealed but not stored, so it is checked against the user row once per
// request: a deleted user, or a session older than users.session_version, gets 401.
// The row read here is also what callers get back, so admin rights are always current.
export async function requireUser(event: H3Event): Promise<User> {
  if (event.context.user) return event.context.user
  const session = await requireUserSession(event)
  const row = await useDb(event)
    .select({ id: users.id, name: users.name, isAdmin: users.isAdmin, sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, session.user.id))
    .get()
  // Sessions from before session_version existed carry no version and count as 0
  if (!row || row.sessionVersion !== (session.secure?.sessionVersion ?? 0)) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  }
  const { sessionVersion: _, ...user } = row
  event.context.user = user
  return user
}

// Logs this device in; `user` must come from the database, so it has the current session version
export async function startSession(event: H3Event, { sessionVersion, ...user }: User & { sessionVersion: number }) {
  await replaceUserSession(event, { user, secure: { sessionVersion } })
}

// Logs out every other session of the user and keeps the current one
export async function endOtherSessions(event: H3Event, user: User) {
  const row = await useDb(event)
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning({ sessionVersion: users.sessionVersion })
    .get()
  if (!row) throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  await startSession(event, { ...user, sessionVersion: row.sessionVersion })
}

// Passkeys must check who is there (fingerprint, face, PIN, screen lock), not only that someone touched them.
// nuxt-auth-utils verifies with requireUserVerification: false, so the handlers check the flag themselves.
export function assertUserVerified(info: { userVerified: boolean }, statusCode: 400 | 401) {
  if (!info.userVerified) throw createError({ statusCode, statusMessage: 'User verification required' })
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (!user.isAdmin) throw createError({ statusCode: 403, statusMessage: 'Admins only' })
  return user
}

// --- tokens (invite links, setup) ---

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function newToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

// Tokens are random, so a fast hash is enough (no salt or slow KDF needed)
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// --- WebAuthn challenges: stored server-side and usable once, so responses cannot be replayed ---

export async function storeChallenge(event: H3Event, challenge: string, attemptId: string) {
  const db = useDb(event)
  await db.batch([
    db.delete(authChallenges).where(lt(authChallenges.expiresAt, new Date())),
    db.insert(authChallenges).values({
      attemptId,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    }),
  ])
}

export async function takeChallenge(event: H3Event, attemptId: string) {
  const db = useDb(event)
  const row = await db
    .delete(authChallenges)
    .where(and(eq(authChallenges.attemptId, attemptId), gt(authChallenges.expiresAt, new Date())))
    .returning({ challenge: authChallenges.challenge })
    .get()
  if (!row) throw createError({ statusCode: 400, statusMessage: 'Challenge expired, please try again' })
  return row.challenge
}
