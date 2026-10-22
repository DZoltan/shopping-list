import { sql } from 'drizzle-orm'
import { createItemSchema, idParamsSchema } from '#shared/schemas'
import { normalizeItemText } from '#shared/text'
import { itemSuggestions, items } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id: listId } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const body = await readValidatedBody(event, createItemSchema.parse)
  const db = useDb(event)

  const list = await requireListAccess(db, user.id, listId)

  // Insert the item and remember it for suggestions in one round trip
  const [[item]] = await db.batch([
    db
      .insert(items)
      .values({
        ...body,
        listId,
        addedBy: user.id,
        // Append to the end of the list in the same statement
        position: sql`(select coalesce(max(${items.position}), -1) + 1 from ${items} where ${items.listId} = ${listId})`,
      })
      .returning(),
    db
      .insert(itemSuggestions)
      .values({
        householdId: list.householdId,
        type: list.type,
        text: body.text,
        normalized: normalizeItemText(body.text),
        lastQuantity: body.quantity ?? null,
        lastUsedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [itemSuggestions.householdId, itemSuggestions.type, itemSuggestions.normalized],
        set: {
          text: body.text,
          useCount: sql`${itemSuggestions.useCount} + 1`,
          lastUsedAt: new Date(),
          // Keep the previous quantity when this time none was given
          lastQuantity: sql`coalesce(excluded.last_quantity, ${itemSuggestions.lastQuantity})`,
        },
      }),
  ])

  setResponseStatus(event, 201)
  return { ...item!, addedByName: user.name }
})
