import { INVITE_TTL_DAYS } from '#shared/constants'
import { createInviteSchema } from '#shared/schemas'
import { invites } from '../../db/schema'

// Returns the invite link once; only a hash of its token is stored
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, createInviteSchema.parse)
  const db = useDb(event)

  if (!(await canInviteTo(db, user, body.householdId))) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot invite people to this household' })
  }

  const token = newToken()
  const invite = await db
    .insert(invites)
    .values({
      ...body,
      tokenHash: await hashToken(token),
      createdBy: user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: invites.id, name: invites.name, expiresAt: invites.expiresAt })
    .get()

  setResponseStatus(event, 201)
  return { ...invite, url: `${getRequestURL(event).origin}/invite/${token}` }
})
