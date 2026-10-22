import { eq } from 'drizzle-orm'
import { idParamsSchema, updateListSchema } from '#shared/schemas'
import { lists } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, updateListSchema.parse)
  const db = useDb(event)

  const [list] = await db.update(lists).set(body).where(eq(lists.id, id)).returning()
  if (!list) throw notFound('List')
  return list
})
