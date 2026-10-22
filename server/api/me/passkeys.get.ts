import { asc, eq } from 'drizzle-orm'
import { credentials } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return useDb(event)
    .select({
      id: credentials.id,
      backedUp: credentials.backedUp,
      createdAt: credentials.createdAt,
      lastUsedAt: credentials.lastUsedAt,
    })
    .from(credentials)
    .where(eq(credentials.userId, user.id))
    .orderBy(asc(credentials.createdAt))
})
