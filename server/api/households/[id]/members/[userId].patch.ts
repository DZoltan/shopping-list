import { and, eq } from 'drizzle-orm'
import { memberParamsSchema, updateMemberSchema } from '#shared/schemas'
import { householdMembers } from '../../../../db/schema'

// Changes a member's role. The last owner cannot be demoted, so a household always has one.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id: householdId, userId } = await getValidatedRouterParams(event, memberParamsSchema.parse)
  const { role } = await readValidatedBody(event, updateMemberSchema.parse)
  const db = useDb(event)

  await requireHouseholdAccess(db, user, householdId, 'owner')
  const target = await getMembership(db, userId, householdId)
  if (!target) throw notFound('Member')

  if (target.role === 'owner' && role === 'member') {
    const { owners } = await countMembers(db, householdId)
    if (owners <= 1) throw createError({ statusCode: 400, statusMessage: 'The household needs at least one owner' })
  }

  await db
    .update(householdMembers)
    .set({ role })
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
  return { userId, role }
})
