import type { User } from '#auth-utils'
import { and, count, eq } from 'drizzle-orm'
import { householdMembers } from '../db/schema'

type Db = ReturnType<typeof useDb>

// Members may look at their household; owners (and admins) may change it.
// Non-members get 404, so household ids cannot be probed.
export async function requireHouseholdAccess(db: Db, user: User, householdId: number, need: 'member' | 'owner') {
  const membership = await getMembership(db, user.id, householdId)
  if (!membership && !user.isAdmin) throw notFound('Household')
  if (need === 'owner' && membership?.role !== 'owner' && !user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Only the household owner can do this' })
  }
  return membership
}

export async function countMembers(db: Db, householdId: number) {
  const [all, owners] = await db.batch([
    db.select({ n: count() }).from(householdMembers).where(eq(householdMembers.householdId, householdId)),
    db
      .select({ n: count() })
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.role, 'owner'))),
  ])
  return { members: all[0]?.n ?? 0, owners: owners[0]?.n ?? 0 }
}
