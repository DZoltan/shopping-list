import { and, eq, inArray } from 'drizzle-orm'
import { idParamsSchema, updateItemSchema } from '#shared/schemas'
import { items } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, updateItemSchema.parse)
  const db = useDb(event)

  const item = await db
    .update(items)
    .set(body)
    .where(and(eq(items.id, id), inArray(items.listId, accessibleListIds(db, user.id))))
    .returning()
    .get()
  if (!item) throw notFound('Item')
  return item
})
