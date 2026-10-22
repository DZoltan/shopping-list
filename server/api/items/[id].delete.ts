import { eq } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { items } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const deleted = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id })
  if (deleted.length === 0) throw notFound('Item')
  setResponseStatus(event, 204)
  return null
})
