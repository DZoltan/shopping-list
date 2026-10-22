import { and, count, eq } from 'drizzle-orm'
import { credentialParamsSchema } from '#shared/schemas'
import { credentials } from '../../../db/schema'

// Removes one of your passkeys (e.g. of a lost phone). The last one is kept,
// otherwise the account could only be reached again with a recovery link.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, credentialParamsSchema.parse)
  const db = useDb(event)

  const row = await db.select({ n: count() }).from(credentials).where(eq(credentials.userId, user.id)).get()
  if ((row?.n ?? 0) <= 1) throw createError({ statusCode: 400, statusMessage: 'You cannot delete your last passkey' })

  const deleted = await db
    .delete(credentials)
    .where(and(eq(credentials.id, id), eq(credentials.userId, user.id)))
    .returning({ id: credentials.id })
  if (deleted.length === 0) throw notFound('Passkey')
  setResponseStatus(event, 204)
  return null
})
