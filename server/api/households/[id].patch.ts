import { eq } from 'drizzle-orm'
import { idParamsSchema, renameHouseholdSchema } from '#shared/schemas'
import { households } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, renameHouseholdSchema.parse)
  const db = useDb(event)

  await requireHouseholdAccess(db, user, id, 'owner')
  const household = await db
    .update(households)
    .set(body)
    .where(eq(households.id, id))
    .returning({ id: households.id, name: households.name })
    .get()
  if (!household) throw notFound('Household')
  return household
})
