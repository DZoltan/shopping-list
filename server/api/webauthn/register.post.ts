import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { registerUserSchema } from '#shared/schemas'
import { credentials, householdMembers, households, invites, users } from '../../db/schema'

// Creates a passkey. Three ways in, decided by the `user` object in the body:
// - inviteToken: a new user accepting an invite
// - setupToken: the very first user, who becomes admin
// - neither: a logged-in user adding a passkey for another device
export default defineWebAuthnRegisterEventHandler({
  storeChallenge,
  getChallenge: takeChallenge,

  getOptions() {
    return {
      rpName: 'Listák',
      // Discoverable credentials, so login needs no user name
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    }
  },

  // Runs before both steps (options and verification); rejects requests without a valid way in
  async validateUser(body, event) {
    const user = registerUserSchema.parse(body)
    const db = useDb(event)

    if (user.inviteToken) {
      const invite = await findUsableInvite(db, await hashToken(user.inviteToken))
      if (!invite) throw createError({ statusCode: 400, statusMessage: 'Invite is invalid, used or expired' })
    } else if (user.setupToken) {
      await assertSetupAllowed(event, db, user.setupToken)
    } else {
      await requireUserSession(event)
    }
    return user
  },

  async onSuccess(event, { user: body, credential }) {
    const user = registerUserSchema.parse(body)
    const db = useDb(event)
    const credentialRow = {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      backedUp: credential.backedUp,
      transports: credential.transports ?? null,
    }

    // Adding a passkey to the current account
    if (!user.inviteToken && !user.setupToken) {
      const { user: current } = await requireUserSession(event)
      await db.insert(credentials).values({ ...credentialRow, userId: current.id })
      return
    }

    if (user.setupToken) {
      await assertSetupAllowed(event, db, user.setupToken)
      const created = await createUser(db, { name: user.userName, isAdmin: true })
      const household = await db
        .insert(households)
        .values({ name: user.householdName ?? 'Otthon' })
        .returning()
        .get()
      await db.batch([
        db.insert(householdMembers).values({ householdId: household.id, userId: created.id, role: 'owner' }),
        db.insert(credentials).values({ ...credentialRow, userId: created.id }),
      ])
      await setUserSession(event, { user: created })
      return
    }

    // Accepting an invite: claim it first, so it can only be used once even under concurrent requests
    const invite = await db
      .update(invites)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(invites.tokenHash, await hashToken(user.inviteToken!)),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .returning()
      .get()
    if (!invite) throw createError({ statusCode: 400, statusMessage: 'Invite is invalid, used or expired' })

    const created = await createUser(db, { name: user.userName, isAdmin: false })
    try {
      const householdId =
        invite.householdId ??
        (
          await db
            .insert(households)
            .values({ name: user.householdName ?? `${user.userName} háztartása` })
            .returning()
            .get()
        ).id
      await db.batch([
        db.insert(householdMembers).values({ householdId, userId: created.id, role: invite.role }),
        db.insert(credentials).values({ ...credentialRow, userId: created.id }),
        db.update(invites).set({ usedBy: created.id }).where(eq(invites.id, invite.id)),
      ])
    } catch (error) {
      // Undo, so the invite can be used again
      await db.batch([
        db.delete(users).where(eq(users.id, created.id)),
        db.update(invites).set({ usedAt: null }).where(eq(invites.id, invite.id)),
      ])
      throw error
    }
    await setUserSession(event, { user: created })
  },
})

type Db = ReturnType<typeof useDb>

function findUsableInvite(db: Db, tokenHash: string) {
  return db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.tokenHash, tokenHash), isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
    .get()
}

async function assertSetupAllowed(event: Parameters<typeof useDb>[0], db: Db, setupToken: string) {
  const expected = useRuntimeConfig(event).adminSetupToken
  // Compare hashes so the comparison time does not depend on the secret
  const valid = !!expected && (await hashToken(setupToken)) === (await hashToken(expected))
  const existing = await db.select({ n: count() }).from(users).get()
  if (!valid || (existing?.n ?? 0) > 0) {
    throw createError({ statusCode: 403, statusMessage: 'Setup is not available' })
  }
}

function createUser(db: Db, values: { name: string, isAdmin: boolean }) {
  return db
    .insert(users)
    .values(values)
    .returning({ id: users.id, name: users.name, isAdmin: users.isAdmin })
    .get()
}
