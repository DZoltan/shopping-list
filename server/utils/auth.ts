import type { H3Event } from 'h3'
import { and, eq, gt, lt } from 'drizzle-orm'
import { authChallenges } from '../db/schema'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  return user
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
