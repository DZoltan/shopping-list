import { and, eq } from 'drizzle-orm'
import { idParamsSchema, reorderItemsSchema } from '#shared/schemas'
import { items } from '../../../db/schema'

// Saves a new order: position = index in itemIds. Ids of other lists are ignored,
// because every update is also filtered by this list's id.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id: listId } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const { itemIds } = await readValidatedBody(event, reorderItemsSchema.parse)
  const db = useDb(event)

  await requireListAccess(db, user.id, listId)

  // One round trip; D1 runs the batch as a single transaction
  const [first, ...rest] = itemIds.map((itemId, position) =>
    db.update(items).set({ position }).where(and(eq(items.id, itemId), eq(items.listId, listId))),
  )
  await db.batch([first!, ...rest])

  setResponseStatus(event, 204)
  return null
})
