import { and, eq, gt, isNull } from 'drizzle-orm'
import { tokenQuerySchema } from '#shared/schemas'
import { households, invites, users } from '../../db/schema'

// Public: what the invite page shows before the invitee creates a passkey
export default defineEventHandler(async (event) => {
  const { token } = await getValidatedQuery(event, tokenQuerySchema.parse)
  const db = useDb(event)

  const invite = await db
    .select({
      name: invites.name,
      role: invites.role,
      householdName: households.name,
      invitedBy: users.name,
    })
    .from(invites)
    .leftJoin(households, eq(households.id, invites.householdId))
    .innerJoin(users, eq(users.id, invites.createdBy))
    .where(and(eq(invites.tokenHash, await hashToken(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
    .get()

  if (!invite) throw notFound('Invite')
  return invite
})
