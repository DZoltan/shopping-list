import { eq } from 'drizzle-orm'
import { idParamsSchema, updateItemSchema } from '#shared/schemas'
import { items } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, updateItemSchema.parse)
  const db = useDb(event)

  const [item] = await db.update(items).set(body).where(eq(items.id, id)).returning()
  if (!item) throw notFound('Item')
  return item
})
