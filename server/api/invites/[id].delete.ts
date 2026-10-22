import { and, eq, isNull } from 'drizzle-orm'
import { idParamsSchema } from '#shared/schemas'
import { invites } from '../../db/schema'

// Revokes an unused invite
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await getValidatedRouterParams(event, idParamsSchema.parse)
  const db = useDb(event)

  const invite = await db
    .select({ householdId: invites.householdId })
    .from(invites)
    .where(and(eq(invites.id, id), isNull(invites.usedAt)))
    .get()
  if (!invite || !(await canInviteTo(db, user, invite.householdId))) throw notFound('Invite')

  await db.delete(invites).where(eq(invites.id, id))
  setResponseStatus(event, 204)
  return null
})
