import { asc, eq } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { items, lists } from '../../db/schema'

// Returns the list with its items: open items first, then by position
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  // One round trip to D1 for both queries
  const [[list], listItems] = await db.batch([
    db.select().from(lists).where(eq(lists.id, id)).limit(1),
    db
      .select()
      .from(items)
      .where(eq(items.listId, id))
      .orderBy(asc(items.done), asc(items.position), asc(items.id)),
  ])

  if (!list) throw notFound('List')
  return { ...list, items: listItems }
})
