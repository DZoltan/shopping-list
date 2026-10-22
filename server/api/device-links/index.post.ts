import { and, eq, isNull } from 'drizzle-orm'
import { DEVICE_LINK_TTL_MINUTES, RECOVERY_LINK_TTL_HOURS } from '#shared/constants'
import { createDeviceLinkSchema } from '#shared/schemas'
import { deviceLinks, users } from '../../db/schema'

// Creates a one-time login link: for yourself (another device) or, as admin, for someone else (recovery).
// Only the newest unused link of a user stays valid.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { userId = user.id } = await readValidatedBody(event, createDeviceLinkSchema.parse)
  const db = useDb(event)

  const forSelf = userId === user.id
  if (!forSelf) {
    if (!user.isAdmin) throw createError({ statusCode: 403, statusMessage: 'Admins only' })
    const target = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get()
    if (!target) throw notFound('User')
  }

  const token = newToken()
  const ttlMs = forSelf ? DEVICE_LINK_TTL_MINUTES * 60 * 1000 : RECOVERY_LINK_TTL_HOURS * 60 * 60 * 1000
  const expiresAt = new Date(Date.now() + ttlMs)
  await db.batch([
    db.delete(deviceLinks).where(and(eq(deviceLinks.userId, userId), isNull(deviceLinks.usedAt))),
    db.insert(deviceLinks).values({ tokenHash: await hashToken(token), userId, createdBy: user.id, expiresAt }),
  ])

  setResponseStatus(event, 201)
  return { url: `${getRequestURL(event).origin}/device/${token}`, expiresAt }
})
