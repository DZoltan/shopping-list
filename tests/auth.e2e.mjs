// End-to-end auth and household isolation test, using a software passkey authenticator (ES256, "none" attestation).
// Needs an empty local DB (no users) and a running server:
//   node tests/auth.e2e.mjs [baseUrl] [setupToken]
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

const BASE = process.argv[2] ?? 'http://localhost:3123'
const SETUP_TOKEN = process.argv[3] ?? 'local-dev-setup-token-0123456789'
const RP_ID = new URL(BASE).hostname
const ORIGIN = new URL(BASE).origin

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const sha256 = (data) => createHash('sha256').update(data).digest()

// --- minimal CBOR encoder (ints, byte strings, text, maps) ---
function cborHead(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n])
  if (n < 256) return Buffer.from([(major << 5) | 24, n])
  if (n < 65536) return Buffer.from([(major << 5) | 25, n >> 8, n & 255])
  throw new Error('too big')
}
function cbor(value) {
  if (typeof value === 'number') return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
  if (Buffer.isBuffer(value)) return Buffer.concat([cborHead(2, value.length), value])
  if (typeof value === 'string') { const b = Buffer.from(value); return Buffer.concat([cborHead(3, b.length), b]) }
  if (value instanceof Map) {
    return Buffer.concat([cborHead(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])])
  }
  throw new Error('unsupported')
}

class Authenticator {
  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    this.privateKey = privateKey
    const jwk = publicKey.export({ format: 'jwk' })
    this.cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]))
    this.credId = randomBytes(16)
    this.counter = 0
  }
  clientData(type, challenge) {
    return Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }))
  }
  register(options) {
    const authData = Buffer.concat([
      sha256(RP_ID), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16),
      Buffer.from([0, this.credId.length]), this.credId, this.cose,
    ])
    const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))
    return {
      id: b64url(this.credId), rawId: b64url(this.credId), type: 'public-key',
      response: { clientDataJSON: b64url(this.clientData('webauthn.create', options.challenge)), attestationObject: b64url(attestationObject), transports: ['internal'] },
      clientExtensionResults: {}, authenticatorAttachment: 'platform',
    }
  }
  authenticate(options) {
    this.counter++
    const counter = Buffer.alloc(4); counter.writeUInt32BE(this.counter)
    const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x05]), counter])
    const clientDataJSON = this.clientData('webauthn.get', options.challenge)
    const signature = sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), this.privateKey)
    return {
      id: b64url(this.credId), rawId: b64url(this.credId), type: 'public-key',
      response: { clientDataJSON: b64url(clientDataJSON), authenticatorData: b64url(authData), signature: b64url(signature) },
      clientExtensionResults: {},
    }
  }
}

class Client {
  constructor(name) { this.name = name; this.cookie = '' }
  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method, headers: { 'content-type': 'application/json', ...(this.cookie && { cookie: this.cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('nuxt-session='))
    if (setCookie) this.cookie = setCookie.split(';')[0]
    const text = await res.text()
    let data; try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data }
  }
  async registerPasskey(auth, user) {
    const start = await this.req('POST', '/api/webauthn/register', { user, verify: false })
    if (start.status !== 200) return start
    return this.req('POST', '/api/webauthn/register', {
      user, attemptId: start.data.attemptId, response: auth.register(start.data.creationOptions), verify: true,
    })
  }
  async login(auth) {
    const start = await this.req('POST', '/api/webauthn/authenticate', { verify: false })
    const response = auth.authenticate(start.data.requestOptions)
    const body = { attemptId: start.data.attemptId, response, verify: true }
    const res = await this.req('POST', '/api/webauthn/authenticate', body)
    return { res, body }
  }
}

let failures = 0
function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`}`)
}

const anon = new Client('anon')
const admin = new Client('admin'); const adminKey = new Authenticator()
const bob = new Client('bob'); const bobKey = new Authenticator()
const carol = new Client('carol'); const carolKey = new Authenticator()

console.log('# public / unauthenticated')
check('setup needed', (await anon.req('GET', '/api/auth/setup-status')).data.needed, true)
check('GET /api/lists without session -> 401', (await anon.req('GET', '/api/lists')).status, 401)
check('POST /api/invites without session -> 401', (await anon.req('POST', '/api/invites', { name: 'x', householdId: null, role: 'owner' })).status, 401)
check('register without token or session -> 401', (await anon.registerPasskey(new Authenticator(), { userName: 'x' })).status, 401)

console.log('# setup')
check('setup with wrong token -> 403', (await new Client('x').registerPasskey(new Authenticator(), { userName: 'Mallory', setupToken: 'wrong-token-wrong-token-wrong' })).status, 403)
check('setup with right token -> 200', (await admin.registerPasskey(adminKey, { userName: 'Admin', setupToken: SETUP_TOKEN, householdName: 'Otthon' })).status, 200)
const adminMe = (await admin.req('GET', '/api/me')).data
check('admin is admin', adminMe.isAdmin, true)
check('admin owns one household', adminMe.households.length === 1 && adminMe.households[0].role === 'owner', true)
check('second setup -> 403', (await new Client('x').registerPasskey(new Authenticator(), { userName: 'Again', setupToken: SETUP_TOKEN })).status, 403)
check('setup no longer needed', (await anon.req('GET', '/api/auth/setup-status')).data.needed, false)

console.log('# lists and invites')
const homeId = adminMe.households[0].id
const list = (await admin.req('POST', '/api/lists', { type: 'shopping', name: 'Közös' })).data
check('admin creates list in own household', list.householdId, homeId)
const inviteBob = (await admin.req('POST', '/api/invites', { name: 'Bob', householdId: homeId, role: 'member' })).data
const inviteCarol = (await admin.req('POST', '/api/invites', { name: 'Carol', householdId: null, role: 'owner' })).data
const bobToken = inviteBob.url.split('/invite/')[1]
const carolToken = inviteCarol.url.split('/invite/')[1]
check('invite lookup (public)', (await anon.req('GET', `/api/invites/lookup?token=${bobToken}`)).data.householdName, 'Otthon')
check('invite lookup with bad token -> 404', (await anon.req('GET', `/api/invites/lookup?token=${'x'.repeat(43)}`)).status, 404)
check('new-household invite must be owner -> 400', (await admin.req('POST', '/api/invites', { name: 'X', householdId: null, role: 'member' })).status, 400)

console.log('# invitee joins existing household')
check('bob accepts invite', (await bob.registerPasskey(bobKey, { userName: 'Bob', inviteToken: bobToken })).status, 200)
check('invite cannot be reused', (await new Client('x').registerPasskey(new Authenticator(), { userName: 'Eve', inviteToken: bobToken })).status, 400)
check('used invite lookup -> 404', (await anon.req('GET', `/api/invites/lookup?token=${bobToken}`)).status, 404)
check('bob sees the shared list', (await bob.req('GET', '/api/lists')).data.length, 1)
const item = (await bob.req('POST', `/api/lists/${list.id}/items`, { text: 'tej' })).data
check('item records who added it', item.addedByName, 'Bob')
check('admin sees bob as author', (await admin.req('GET', `/api/lists/${list.id}`)).data.items[0].addedByName, 'Bob')
check('member cannot invite -> 403', (await bob.req('POST', '/api/invites', { name: 'Y', householdId: homeId, role: 'member' })).status, 403)

console.log('# invitee with a new household is isolated')
check('carol accepts invite', (await carol.registerPasskey(carolKey, { userName: 'Carol', inviteToken: carolToken, householdName: 'Carol otthona' })).status, 200)
const carolMe = (await carol.req('GET', '/api/me')).data
check('carol owns her new household', carolMe.households.length === 1 && carolMe.households[0].name === 'Carol otthona' && carolMe.households[0].role === 'owner', true)
check('carol sees no lists', (await carol.req('GET', '/api/lists')).data.length, 0)
check('carol GET foreign list -> 404', (await carol.req('GET', `/api/lists/${list.id}`)).status, 404)
check('carol PATCH foreign list -> 404', (await carol.req('PATCH', `/api/lists/${list.id}`, { name: 'hacked' })).status, 404)
check('carol adds item to foreign list -> 404', (await carol.req('POST', `/api/lists/${list.id}/items`, { text: 'x' })).status, 404)
check('carol PATCH foreign item -> 404', (await carol.req('PATCH', `/api/items/${item.id}`, { done: true })).status, 404)
check('carol DELETE foreign item -> 404', (await carol.req('DELETE', `/api/items/${item.id}`)).status, 404)
check('carol DELETE foreign list -> 404', (await carol.req('DELETE', `/api/lists/${list.id}`)).status, 404)
check('carol creates list in foreign household -> 403', (await carol.req('POST', '/api/lists', { type: 'todo', name: 'x', householdId: homeId })).status, 403)
check('carol invites into foreign household -> 403', (await carol.req('POST', '/api/invites', { name: 'Z', householdId: homeId, role: 'member' })).status, 403)
check('carol (non-admin) cannot invite to a new household -> 403', (await carol.req('POST', '/api/invites', { name: 'Z', householdId: null, role: 'owner' })).status, 403)
check('carol invites into her own household', (await carol.req('POST', '/api/invites', { name: 'Dave', householdId: carolMe.households[0].id, role: 'member' })).status, 201)
check('carol sees only her invites', (await carol.req('GET', '/api/invites')).data.every((i) => i.householdId === carolMe.households[0].id), true)
check('carol cannot list users -> 403', (await carol.req('GET', '/api/admin/users')).status, 403)
check('foreign list untouched', (await admin.req('GET', `/api/lists/${list.id}`)).data.name, 'Közös')

console.log('# login')
const fresh = new Client('bob-2')
const { res: loginRes, body: loginBody } = await fresh.login(bobKey)
check('bob logs in with passkey', loginRes.status, 200)
check('new session is bob', (await fresh.req('GET', '/api/me')).data.name, 'Bob')
check('replayed login response is rejected', (await new Client('replay').req('POST', '/api/webauthn/authenticate', loginBody)).status, 400)
check('unknown passkey -> 401', (await new Client('x').login(new Authenticator())).res.status, 401)

console.log('# device links')
const tokenOf = (url) => url.split('/device/')[1]
const bobLink = (await bob.req('POST', '/api/device-links', {})).data
check('bob creates a link for himself', typeof bobLink.url, 'string')
check('link lives about 10 minutes', Math.abs(new Date(bobLink.expiresAt) - Date.now() - 10 * 60e3) < 60e3, true)
check('lookup shows whose link it is', (await anon.req('GET', `/api/device-links/lookup?token=${tokenOf(bobLink.url)}`)).data.name, 'Bob')
check('lookup does not use the link up', (await anon.req('GET', `/api/device-links/lookup?token=${tokenOf(bobLink.url)}`)).status, 200)
const laptop = new Client('bob-laptop')
check('redeem on another device', (await laptop.req('POST', '/api/device-links/redeem', { token: tokenOf(bobLink.url) })).status, 200)
check('other device is logged in as bob', (await laptop.req('GET', '/api/me')).data.name, 'Bob')
check('link works only once', (await new Client('x').req('POST', '/api/device-links/redeem', { token: tokenOf(bobLink.url) })).status, 400)
check('used link lookup -> 404', (await anon.req('GET', `/api/device-links/lookup?token=${tokenOf(bobLink.url)}`)).status, 404)
const older = (await bob.req('POST', '/api/device-links', {})).data
await bob.req('POST', '/api/device-links', {})
check('a new link invalidates the previous one', (await new Client('x').req('POST', '/api/device-links/redeem', { token: tokenOf(older.url) })).status, 400)
check('non-admin cannot create a link for someone else -> 403', (await bob.req('POST', '/api/device-links', { userId: adminMe.id })).status, 403)
check('creating a link needs a session -> 401', (await anon.req('POST', '/api/device-links', {})).status, 401)
const recoveryLink = (await admin.req('POST', '/api/device-links', { userId: (await bob.req('GET', '/api/me')).data.id })).data
check('admin recovery link lives about 24 hours', Math.abs(new Date(recoveryLink.expiresAt) - Date.now() - 24 * 3600e3) < 60e3, true)
const recovered = new Client('bob-recovered')
check('recovery link logs in as bob', (await recovered.req('POST', '/api/device-links/redeem', { token: tokenOf(recoveryLink.url) })).data.name, 'Bob')

console.log('# passkey management')
check('bob has one passkey', (await bob.req('GET', '/api/me/passkeys')).data.length, 1)
const bobPasskeyId = (await bob.req('GET', '/api/me/passkeys')).data[0].id
check('last passkey cannot be deleted -> 400', (await bob.req('DELETE', `/api/me/passkeys/${bobPasskeyId}`)).status, 400)
const bobLaptopKey = new Authenticator()
check('logged-in bob adds a passkey on the laptop', (await laptop.registerPasskey(bobLaptopKey, { userName: 'Bob' })).status, 200)
check('bob now has two passkeys', (await bob.req('GET', '/api/me/passkeys')).data.length, 2)
check('the laptop passkey logs in as bob', (await (async () => { const c = new Client('x'); await c.login(bobLaptopKey); return (await c.req('GET', '/api/me')).data.name })()), 'Bob')
await admin.registerPasskey(new Authenticator(), { userName: 'Admin' })
check("admin cannot delete bob's passkey -> 404", (await admin.req('DELETE', `/api/me/passkeys/${bobPasskeyId}`)).status, 404)
check('bob deletes his first passkey', (await bob.req('DELETE', `/api/me/passkeys/${bobPasskeyId}`)).status, 204)
check('deleted passkey cannot log in', (await new Client('x').login(bobKey)).res.status, 401)

console.log('# admin')
const usersList = (await admin.req('GET', '/api/admin/users')).data
check('admin lists 3 users', usersList.length, 3)
const carolUser = usersList.find((u) => u.name === 'Carol')
check('admin cannot delete self -> 400', (await admin.req('DELETE', `/api/admin/users/${adminMe.id}`)).status, 400)
check('admin deletes carol', (await admin.req('DELETE', `/api/admin/users/${carolUser.id}`)).status, 204)
check('deleted user loses access to everything', (await carol.req('GET', '/api/me')).data.households.length, 0)
check('deleted user cannot log in', (await new Client('x').login(carolKey)).res.status, 401)

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
