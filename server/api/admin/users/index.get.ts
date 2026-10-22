import { asc, count, eq } from 'drizzle-orm'
import { credentials, householdMembers, households, users } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb(event)

  const [userRows, memberships, passkeys] = await db.batch([
    db.select({ id: users.id, name: users.name, isAdmin: users.isAdmin, createdAt: users.createdAt }).from(users).orderBy(asc(users.id)),
    db
      .select({ userId: householdMembers.userId, householdId: households.id, name: households.name, role: householdMembers.role })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId)),
    db.select({ userId: credentials.userId, n: count() }).from(credentials).groupBy(credentials.userId),
  ])

  return userRows.map((u) => ({
    ...u,
    households: memberships.filter((m) => m.userId === u.id).map(({ userId: _, ...m }) => m),
    passkeys: passkeys.find((p) => p.userId === u.id)?.n ?? 0,
  }))
})
