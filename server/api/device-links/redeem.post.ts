import { and, eq, gt, isNull } from 'drizzle-orm'
import { redeemDeviceLinkSchema } from '#shared/schemas'
import { deviceLinks, users } from '../../db/schema'

// Public: logs this device in as the link's user. The link is claimed in one statement,
// so it works only once even if opened twice at the same time.
export default defineEventHandler(async (event) => {
  const { token } = await readValidatedBody(event, redeemDeviceLinkSchema.parse)
  const db = useDb(event)

  const link = await db
    .update(deviceLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(deviceLinks.tokenHash, await hashToken(token)), isNull(deviceLinks.usedAt), gt(deviceLinks.expiresAt, new Date())))
    .returning({ userId: deviceLinks.userId })
    .get()
  if (!link) throw createError({ statusCode: 400, statusMessage: 'Link is invalid, used or expired' })

  const user = await db
    .select({ id: users.id, name: users.name, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, link.userId))
    .get()
  if (!user) throw createError({ statusCode: 400, statusMessage: 'Link is invalid, used or expired' })

  await setUserSession(event, { user })
  return user
})
