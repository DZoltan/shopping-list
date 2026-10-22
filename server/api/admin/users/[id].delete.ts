import { eq } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { users } from '../../../db/schema'

// Deletes the user with their passkeys and memberships. Their sessions stop working,
// because every query is scoped by household membership.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  if (id === admin.id) throw createError({ statusCode: 400, statusMessage: 'You cannot delete yourself' })

  const deleted = await useDb(event).delete(users).where(eq(users.id, id)).returning({ id: users.id })
  if (deleted.length === 0) throw notFound('User')
  setResponseStatus(event, 204)
  return null
})
