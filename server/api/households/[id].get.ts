import { asc, eq } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { householdMembers, households, users } from '../../db/schema'

// The household with its members, for anyone in it
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const membership = await requireHouseholdAccess(db, user, id, 'member')
  const [[household], members] = await db.batch([
    db.select({ id: households.id, name: households.name }).from(households).where(eq(households.id, id)).limit(1),
    db
      .select({ id: users.id, name: users.name, role: householdMembers.role })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, id))
      .orderBy(asc(householdMembers.createdAt), asc(users.id)),
  ])
  if (!household) throw notFound('Household')

  return {
    ...household,
    myRole: membership?.role ?? null,
    canManage: membership?.role === 'owner' || user.isAdmin,
    members,
  }
})
