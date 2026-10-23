import { eq } from 'drizzle-orm'
import { credentials, users } from '../../db/schema'

// Passkey login with discoverable credentials: the browser offers the passkeys it has for this site
export default defineWebAuthnAuthenticateEventHandler({
  storeChallenge,
  getChallenge: takeChallenge,

  getOptions() {
    return { userVerification: 'required' }
  },

  async getCredential(event, credentialId) {
    const credential = await useDb(event).select().from(credentials).where(eq(credentials.id, credentialId)).get()
    if (!credential) throw createError({ statusCode: 401, statusMessage: 'Unknown passkey' })
    return { ...credential, transports: credential.transports ?? undefined }
  },

  async onSuccess(event, { credential, authenticationInfo }) {
    assertUserVerified(authenticationInfo, 401)
    const db = useDb(event)
    const [, user] = await db.batch([
      db
        .update(credentials)
        .set({ counter: authenticationInfo.newCounter, lastUsedAt: new Date() })
        .where(eq(credentials.id, credential.id)),
      db
        .select({ id: users.id, name: users.name, isAdmin: users.isAdmin, sessionVersion: users.sessionVersion })
        .from(users)
        .innerJoin(credentials, eq(credentials.userId, users.id))
        .where(eq(credentials.id, credential.id))
        .limit(1),
    ])
    if (!user[0]) throw createError({ statusCode: 401, statusMessage: 'Unknown passkey' })
    await startSession(event, user[0])
  },
})
