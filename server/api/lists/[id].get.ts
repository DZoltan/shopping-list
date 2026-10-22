import { and, asc, eq, inArray } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { items, lists, users } from '../../db/schema'

// Returns the list with its items: open items first, then by position
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  // One round trip to D1 for both queries; the items are discarded if the list is not accessible
  const [[list], listItems] = await db.batch([
    db
      .select()
      .from(lists)
      .where(and(eq(lists.id, id), inArray(lists.householdId, memberHouseholdIds(db, user.id))))
      .limit(1),
    db
      .select({ item: items, addedByName: users.name })
      .from(items)
      .leftJoin(users, eq(users.id, items.addedBy))
      .where(eq(items.listId, id))
      .orderBy(asc(items.done), asc(items.position), asc(items.id)),
  ])

  if (!list) throw notFound('List')
  return { ...list, items: listItems.map(({ item, addedByName }) => ({ ...item, addedByName })) }
})
