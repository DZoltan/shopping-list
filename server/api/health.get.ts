import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const row = await db.get<{ ok: number }>(sql`select 1 as ok`)
  return { status: 'ok', db: row?.ok === 1 }
})
