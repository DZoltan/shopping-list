import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { and, eq, or, sql } from 'drizzle-orm'
import { normalizeItemText } from '#shared/text'
import { CIPHER_PREFIX, INDEX_PREFIX, blindIndex, decrypt } from '../../db/encryption'
import { households, invites, itemSuggestions, items, lists, users } from '../../db/schema'

// One-off conversion of rows written before encryption existed (server/db/encryption.ts).
// Each call converts one chunk, so a request stays well inside the Workers Free query limit;
// the admin page calls it until it answers done. Can be removed once production is converted.
const CHUNK = 15

type Target = { table: SQLiteTable, id: AnySQLiteColumn, columns: Record<string, AnySQLiteColumn> }
const TARGETS: Target[] = [
  { table: users, id: users.id, columns: { name: users.name } },
  { table: households, id: households.id, columns: { name: households.name } },
  { table: invites, id: invites.id, columns: { name: invites.name } },
  { table: lists, id: lists.id, columns: { name: lists.name } },
  { table: items, id: items.id, columns: { text: items.text, quantity: items.quantity, reason: items.reason } },
  { table: itemSuggestions, id: itemSuggestions.id, columns: { text: itemSuggestions.text, lastQuantity: itemSuggestions.lastQuantity } },
]

// Wrapping a column in sql`` skips its column type, so these read and compare the stored value
const stored = (column: AnySQLiteColumn) => sql<string | null>`${column}`
const isPlain = (column: AnySQLiteColumn, prefix: string) =>
  sql`(${column} is not null and substr(${column}, 1, ${prefix.length}) <> ${prefix})`

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb(event)

  for (const target of TARGETS) {
    const entries = Object.entries(target.columns)
    const rows = await db
      .select({ id: target.id, ...Object.fromEntries(entries.map(([key, column]) => [key, stored(column)])) })
      .from(target.table)
      .where(or(...entries.map(([, column]) => isPlain(column, CIPHER_PREFIX))))
      .limit(CHUNK)
    if (!rows.length) continue

    // Assigning the plain value through the column type encrypts it; already encrypted fields are left alone
    const updates = rows.map((row) => {
      const values = Object.fromEntries(
        entries
          .map(([key]) => [key, (row as Record<string, string | null>)[key]] as const)
          .filter(([, value]) => value != null && !value.startsWith(CIPHER_PREFIX)),
      )
      return db.update(target.table).set(values as never).where(eq(target.id, row.id))
    })
    await db.batch(updates as [typeof updates[0], ...typeof updates])
    return { done: false }
  }

  // Suggestions keep a unique key on the normalized text: replace it with its blind index. If the
  // household already has the indexed twin (added after the deploy), merge the old row into it.
  const legacy = await db
    .select({
      id: itemSuggestions.id,
      householdId: itemSuggestions.householdId,
      type: itemSuggestions.type,
      text: itemSuggestions.text,
      useCount: itemSuggestions.useCount,
    })
    .from(itemSuggestions)
    .where(isPlain(itemSuggestions.normalized, INDEX_PREFIX))
    .limit(CHUNK)
  if (!legacy.length) return { done: true }

  const withKey = legacy.map((row) => ({ ...row, normalized: normalizeItemText(decrypt(row.text)) }))
  const twins = await db
    .select({ id: itemSuggestions.id, householdId: itemSuggestions.householdId, type: itemSuggestions.type, index: stored(itemSuggestions.normalized) })
    .from(itemSuggestions)
    .where(or(...withKey.map((row) => and(
      eq(itemSuggestions.householdId, row.householdId),
      eq(itemSuggestions.type, row.type),
      eq(itemSuggestions.normalized, row.normalized),
    ))))
  const statements = withKey.flatMap((row) => {
    const twin = twins.find((t) => t.householdId === row.householdId && t.type === row.type && t.index === blindIndex(row.normalized))
    if (!twin) return [db.update(itemSuggestions).set({ normalized: row.normalized }).where(eq(itemSuggestions.id, row.id))]
    return [
      db.update(itemSuggestions).set({ useCount: sql`${itemSuggestions.useCount} + ${row.useCount}` }).where(eq(itemSuggestions.id, twin.id)),
      db.delete(itemSuggestions).where(eq(itemSuggestions.id, row.id)),
    ]
  })
  await db.batch(statements as [typeof statements[0], ...typeof statements])
  return { done: false }
})
