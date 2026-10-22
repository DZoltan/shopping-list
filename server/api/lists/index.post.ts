import { createListSchema } from '#shared/schemas'
import { lists } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createListSchema.parse)
  const db = useDb(event)

  const [list] = await db.insert(lists).values(body).returning()
  setResponseStatus(event, 201)
  return list
})
