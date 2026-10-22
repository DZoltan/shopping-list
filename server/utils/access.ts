import { and, eq, inArray } from 'drizzle-orm'
import { householdMembers, households, lists } from '../db/schema'

type Db = ReturnType<typeof useDb>

// Every list and item query is scoped through these helpers: a user only ever
// sees data of households they are a member of.

export function memberHouseholdIds(db: Db, userId: number) {
  return db
    .select({ id: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
}

export function accessibleListIds(db: Db, userId: number) {
  return db
    .select({ id: lists.id })
    .from(lists)
    .where(inArray(lists.householdId, memberHouseholdIds(db, userId)))
}

export function getMembership(db: Db, userId: number, householdId: number) {
  return db
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.userId, userId), eq(householdMembers.householdId, householdId)))
    .get()
}

export function getMyHouseholds(db: Db, userId: number) {
  return db
    .select({ id: households.id, name: households.name, role: householdMembers.role })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(households.id)
}

// Lists the user cannot access are reported as missing, so their existence does not leak
export async function requireListAccess(db: Db, userId: number, listId: number) {
  const list = await db
    .select({ id: lists.id, householdId: lists.householdId, type: lists.type })
    .from(lists)
    .where(and(eq(lists.id, listId), inArray(lists.householdId, memberHouseholdIds(db, userId))))
    .get()
  if (!list) throw notFound('List')
  return list
}
