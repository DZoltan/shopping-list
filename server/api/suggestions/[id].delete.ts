import { and, eq, inArray } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { itemSuggestions } from '../../db/schema'

// "Forget" a suggestion (a typo or a one-off). It comes back if the item is added again.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const deleted = await db
    .delete(itemSuggestions)
    .where(and(eq(itemSuggestions.id, id), inArray(itemSuggestions.householdId, memberHouseholdIds(db, user.id))))
    .returning({ id: itemSuggestions.id })
  if (deleted.length === 0) throw notFound('Suggestion')
  setResponseStatus(event, 204)
  return null
})
