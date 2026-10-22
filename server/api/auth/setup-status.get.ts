import { count } from 'drizzle-orm'
import { users } from '../../db/schema'

// Public: tells the /setup page whether the first admin still has to be created
export default defineEventHandler(async (event) => {
  const row = await useDb(event).select({ n: count() }).from(users).get()
  return { needed: (row?.n ?? 0) === 0 }
})
