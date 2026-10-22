import { sql } from 'drizzle-orm'
import { createItemSchema, idParamsSchema } from '#shared/schemas'
import { items } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const { id: listId } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, createItemSchema.parse)
  const db = useDb(event)

  try {
    const item = await db
      .insert(items)
      .values({
        ...body,
        listId,
        // Append to the end of the list in the same statement
        position: sql`(select coalesce(max(${items.position}), -1) + 1 from ${items} where ${items.listId} = ${listId})`,
      })
      .returning()
      .get()
    setResponseStatus(event, 201)
    return item
  } catch (error) {
    if (isForeignKeyError(error)) throw notFound('List')
    throw error
  }
})
