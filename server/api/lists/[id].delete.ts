import { and, eq, inArray } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { lists } from '../../db/schema'

// Items are removed by the ON DELETE CASCADE foreign key
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const deleted = await db
    .delete(lists)
    .where(and(eq(lists.id, id), inArray(lists.householdId, memberHouseholdIds(db, user.id))))
    .returning({ id: lists.id })
  if (deleted.length === 0) throw notFound('List')
  setResponseStatus(event, 204)
  return null
})
