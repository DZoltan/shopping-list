import { eq } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { lists } from '../../db/schema'

// Items are removed by the ON DELETE CASCADE foreign key
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const deleted = await db.delete(lists).where(eq(lists.id, id)).returning({ id: lists.id })
  if (deleted.length === 0) throw notFound('List')
  setResponseStatus(event, 204)
  return null
})
