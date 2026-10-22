import { and, eq, gt, isNull } from 'drizzle-orm'
import { tokenQuerySchema } from '#shared/schemas'
import { deviceLinks, users } from '../../db/schema'

// Public: shows whose account the link opens, without using it up.
// Link previews (chat apps) only ever GET, so they cannot log anyone in.
export default defineEventHandler(async (event) => {
  const { token } = await getValidatedQuery(event, tokenQuerySchema.parse)

  const link = await useDb(event)
    .select({ name: users.name, expiresAt: deviceLinks.expiresAt })
    .from(deviceLinks)
    .innerJoin(users, eq(users.id, deviceLinks.userId))
    .where(and(eq(deviceLinks.tokenHash, await hashToken(token)), isNull(deviceLinks.usedAt), gt(deviceLinks.expiresAt, new Date())))
    .get()

  if (!link) throw notFound('Link')
  return link
})
