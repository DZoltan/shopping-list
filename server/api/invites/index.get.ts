import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm'
import { households, householdMembers, invites, users } from '../../db/schema'

// Open invites the user may manage: all for admins, their own households' for owners
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb(event)

  const ownedHouseholds = db
    .select({ id: householdMembers.householdId })
    .from(householdMembers)
    .where(and(eq(householdMembers.userId, user.id), eq(householdMembers.role, 'owner')))

  return db
    .select({
      id: invites.id,
      name: invites.name,
      role: invites.role,
      householdId: invites.householdId,
      householdName: households.name,
      createdByName: users.name,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .leftJoin(households, eq(households.id, invites.householdId))
    .innerJoin(users, eq(users.id, invites.createdBy))
    .where(
      and(
        isNull(invites.usedAt),
        gt(invites.expiresAt, new Date()),
        user.isAdmin ? undefined : inArray(invites.householdId, ownedHouseholds),
      ),
    )
    .orderBy(desc(invites.id))
})
