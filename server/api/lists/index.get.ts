import { and, asc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { listQuerySchema } from '#shared/schemas'
import { items, lists } from '../../db/schema'

// Lists with open / done item counts for the tiles
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { type } = await getValidatedQuery(event, listQuerySchema.parse)
  const db = useDb(event)

  return db
    .select({
      ...getTableColumns(lists),
      openCount: sql<number>`count(${items.id}) filter (where ${items.done} = 0)`,
      doneCount: sql<number>`count(${items.id}) filter (where ${items.done} = 1)`,
    })
    .from(lists)
    .leftJoin(items, eq(items.listId, lists.id))
    .where(and(inArray(lists.householdId, memberHouseholdIds(db, user.id)), type ? eq(lists.type, type) : undefined))
    .groupBy(lists.id)
    .orderBy(asc(lists.id))
})
