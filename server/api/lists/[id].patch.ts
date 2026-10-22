import { and, eq, inArray } from 'drizzle-orm'
import { idParamsSchema, updateListSchema } from '#shared/schemas'
import { lists } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, updateListSchema.parse)
  const db = useDb(event)

  const list = await db
    .update(lists)
    .set(body)
    .where(and(eq(lists.id, id), inArray(lists.householdId, memberHouseholdIds(db, user.id))))
    .returning()
    .get()
  if (!list) throw notFound('List')
  return list
})
