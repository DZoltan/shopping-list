import { asc, eq } from 'drizzle-orm'
import { listQuerySchema } from '#shared/schemas'
import { lists } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { type } = await getValidatedQuery(event, listQuerySchema.parse)
  const db = useDb(event)

  return db
    .select()
    .from(lists)
    .where(type ? eq(lists.type, type) : undefined)
    .orderBy(asc(lists.id))
})
