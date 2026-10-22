import { sql } from 'drizzle-orm'
import { createItemSchema, idParamsSchema } from '#shared/schemas'
import { items } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id: listId } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, createItemSchema.parse)
  const db = useDb(event)

  await requireListAccess(db, user.id, listId)

  const item = await db
    .insert(items)
    .values({
      ...body,
      listId,
      addedBy: user.id,
      // Append to the end of the list in the same statement
      position: sql`(select coalesce(max(${items.position}), -1) + 1 from ${items} where ${items.listId} = ${listId})`,
    })
    .returning()
    .get()
  setResponseStatus(event, 201)
  return { ...item, addedByName: user.name }
})
