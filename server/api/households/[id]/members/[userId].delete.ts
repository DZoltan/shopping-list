import { and, eq } from 'drizzle-orm'
import { memberParamsSchema } from '#shared/schemas'
import { householdMembers } from '../../../../db/schema'

// Removes a member (owners, admins) or leaves the household (anyone, for themselves).
// The last member cannot leave (the lists would be orphaned), and the last owner
// cannot leave while others remain (the household would have no owner).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id: householdId, userId } = await getValidatedRouterParams(event, memberParamsSchema.parse)
  const db = useDb(event)

  const leaving = userId === user.id
  await requireHouseholdAccess(db, user, householdId, leaving ? 'member' : 'owner')
  const target = await getMembership(db, userId, householdId)
  if (!target) throw notFound('Member')

  const { members, owners } = await countMembers(db, householdId)
  if (members <= 1) {
    throw createError({ statusCode: 400, statusMessage: 'The last member cannot leave the household' })
  }
  if (target.role === 'owner' && owners <= 1) {
    throw createError({ statusCode: 400, statusMessage: 'Make someone else an owner first' })
  }

  await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
  setResponseStatus(event, 204)
  return null
})
