import { and, desc, eq, sql } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { normalizeItemText } from '#shared/text'
import { itemSuggestions } from '../../../db/schema'

const LIMIT = 200
const MONTH_SECONDS = 30 * 24 * 60 * 60

// The household's most likely items for this list's type. The client filters them while typing.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id: listId } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const list = await requireListAccess(db, user.id, listId)

  // "Frecency": use count divided by (1 + months since last use), so an item unused
  // for a month counts half, for two months a third, and so on
  const score = sql<number>`${itemSuggestions.useCount} * 1.0 / (1 + (unixepoch() - ${itemSuggestions.lastUsedAt}) / ${sql.raw(`${MONTH_SECONDS}.0`)})`
  const rows = await db
    .select({
      id: itemSuggestions.id,
      text: itemSuggestions.text,
      lastQuantity: itemSuggestions.lastQuantity,
      useCount: itemSuggestions.useCount,
    })
    .from(itemSuggestions)
    .where(and(eq(itemSuggestions.householdId, list.householdId), eq(itemSuggestions.type, list.type)))
    .orderBy(desc(score), desc(itemSuggestions.lastUsedAt))
    .limit(LIMIT)
  // The stored key is a blind index (server/db/encryption.ts), so the client gets it from the text
  return rows.map((row) => ({ ...row, normalized: normalizeItemText(row.text) }))
})
