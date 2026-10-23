// End-to-end auth and household isolation test, using a software passkey authenticator (ES256, "none" attestation).
// Runs against an empty database: use `npm run test:e2e` (tests/run-e2e.mjs), which starts
// a dev server with its own throwaway local D1, or pass [baseUrl] [setupToken] yourself.
import { createPasskeyKit } from './lib/passkey.mjs'

const BASE = process.argv[2] ?? 'http://localhost:3123'
const SETUP_TOKEN = process.argv[3] ?? 'local-dev-setup-token-0123456789'
const { Authenticator, Client } = createPasskeyKit(BASE)

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
const edited = (await admin.req('PATCH', `/api/items/${item.id}`, { text: 'zsírszegény tej', quantity: '2 l', reason: 'elfogyott' })).data
check('household member edits an item', `${edited.text}|${edited.quantity}|${edited.reason}`, 'zsírszegény tej|2 l|elfogyott')
const cleared = (await bob.req('PATCH', `/api/items/${item.id}`, { quantity: null, reason: '' })).data
check('null and empty string clear optional fields', `${cleared.quantity}|${cleared.reason}|${cleared.text}`, 'null|null|zsírszegény tej')
check('empty item text is rejected -> 400', (await bob.req('PATCH', `/api/items/${item.id}`, { text: '  ' })).status, 400)
const second = (await admin.req('POST', `/api/lists/${list.id}/items`, { text: 'kenyér' })).data
const third = (await admin.req('POST', `/api/lists/${list.id}/items`, { text: 'vaj' })).data
check('new items are appended', `${second.position}|${third.position}`, '1|2')
check('reorder items', (await bob.req('PUT', `/api/lists/${list.id}/order`, { itemIds: [third.id, item.id, second.id] })).status, 204)
check('new order is returned', (await admin.req('GET', `/api/lists/${list.id}`)).data.items.map((i) => i.text).join(','), 'vaj,zsírszegény tej,kenyér')
check('duplicate ids in order -> 400', (await bob.req('PUT', `/api/lists/${list.id}/order`, { itemIds: [item.id, item.id] })).status, 400)
const otherList = (await admin.req('POST', '/api/lists', { type: 'todo', name: 'Másik' })).data
const otherItem = (await admin.req('POST', `/api/lists/${otherList.id}/items`, { text: 'x' })).data
await bob.req('PUT', `/api/lists/${list.id}/order`, { itemIds: [second.id, third.id, otherItem.id, item.id] })
check("reorder ignores another list's items", (await admin.req('GET', `/api/lists/${otherList.id}`)).data.items[0].position, 0)
const suggestionsOf = async (client, listId) => (await client.req('GET', `/api/lists/${listId}/suggestions`)).data
check('added items become suggestions', (await suggestionsOf(bob, list.id)).map((s) => s.normalized).sort().join(','), 'kenyér,tej,vaj')
await bob.req('POST', `/api/lists/${list.id}/items`, { text: '  Tej ', quantity: '1 l' })
await admin.req('POST', `/api/lists/${list.id}/items`, { text: 'TEJ' })
const tej = (await suggestionsOf(bob, list.id)).find((s) => s.normalized === 'tej')
check('same text (any case / spacing) counts up', tej.useCount, 3)
check('last quantity is kept when none is given', tej.lastQuantity, '1 l')
check('most used comes first', (await suggestionsOf(bob, list.id))[0].normalized, 'tej')
check('suggestions are per list type', (await suggestionsOf(bob, otherList.id)).map((s) => s.normalized).join(','), 'x')
check('forget a suggestion', (await bob.req('DELETE', `/api/suggestions/${tej.id}`)).status, 204)
check('forgotten suggestion is gone', (await suggestionsOf(bob, list.id)).some((s) => s.normalized === 'tej'), false)
const vaj = (await suggestionsOf(bob, list.id)).find((s) => s.normalized === 'vaj')
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
check('carol reorders foreign list -> 404', (await carol.req('PUT', `/api/lists/${list.id}/order`, { itemIds: [item.id] })).status, 404)
check('carol cannot read foreign suggestions -> 404', (await carol.req('GET', `/api/lists/${list.id}/suggestions`)).status, 404)
check('carol cannot forget foreign suggestions -> 404', (await carol.req('DELETE', `/api/suggestions/${vaj.id}`)).status, 404)
check('carol DELETE foreign item -> 404', (await carol.req('DELETE', `/api/items/${item.id}`)).status, 404)
check('carol DELETE foreign list -> 404', (await carol.req('DELETE', `/api/lists/${list.id}`)).status, 404)
check('carol creates list in foreign household -> 403', (await carol.req('POST', '/api/lists', { type: 'todo', name: 'x', householdId: homeId })).status, 403)
check('carol invites into foreign household -> 403', (await carol.req('POST', '/api/invites', { name: 'Z', householdId: homeId, role: 'member' })).status, 403)
check('carol (non-admin) cannot invite to a new household -> 403', (await carol.req('POST', '/api/invites', { name: 'Z', householdId: null, role: 'owner' })).status, 403)
check('carol invites into her own household', (await carol.req('POST', '/api/invites', { name: 'Dave', householdId: carolMe.households[0].id, role: 'member' })).status, 201)
check('carol sees only her invites', (await carol.req('GET', '/api/invites')).data.every((i) => i.householdId === carolMe.households[0].id), true)
check('carol cannot list users -> 403', (await carol.req('GET', '/api/admin/users')).status, 403)
check('foreign list untouched', (await admin.req('GET', `/api/lists/${list.id}`)).data.name, 'Közös')

console.log('# households')
const homeUrl = `/api/households/${homeId}`
const bobId = (await bob.req('GET', '/api/me')).data.id
const bobView = (await bob.req('GET', homeUrl)).data
check('member sees household members', bobView.members.map((m) => m.name).join(','), 'Admin,Bob')
check('member cannot manage', bobView.canManage, false)
check('outsider cannot see the household -> 404', (await carol.req('GET', homeUrl)).status, 404)
check('member cannot rename -> 403', (await bob.req('PATCH', homeUrl, { name: 'x' })).status, 403)
check('owner renames household', (await admin.req('PATCH', homeUrl, { name: 'Otthonunk' })).data.name, 'Otthonunk')
check('member cannot remove others -> 403', (await bob.req('DELETE', `${homeUrl}/members/${adminMe.id}`)).status, 403)
check('last owner cannot leave -> 400', (await admin.req('DELETE', `${homeUrl}/members/${adminMe.id}`)).status, 400)
check('last owner cannot be demoted -> 400', (await admin.req('PATCH', `${homeUrl}/members/${adminMe.id}`, { role: 'member' })).status, 400)
check('owner promotes member', (await admin.req('PATCH', `${homeUrl}/members/${bobId}`, { role: 'owner' })).data.role, 'owner')
check('new owner demotes the old one', (await bob.req('PATCH', `${homeUrl}/members/${adminMe.id}`, { role: 'member' })).status, 200)
check('now bob is the last owner and cannot leave -> 400', (await bob.req('DELETE', `${homeUrl}/members/${bobId}`)).status, 400)
await bob.req('PATCH', `${homeUrl}/members/${adminMe.id}`, { role: 'owner' })
check('member leaves the household', (await bob.req('DELETE', `${homeUrl}/members/${bobId}`)).status, 204)
check('after leaving: no lists', (await bob.req('GET', '/api/lists')).data.length, 0)
check('after leaving: household hidden -> 404', (await bob.req('GET', homeUrl)).status, 404)
check('last member cannot leave -> 400', (await carol.req('DELETE', `/api/households/${carolMe.households[0].id}/members/${carolMe.id}`)).status, 400)
check('removing a non-member -> 404', (await admin.req('DELETE', `${homeUrl}/members/${bobId}`)).status, 404)

console.log('# login')
const fresh = new Client('bob-2')
const { res: loginRes, body: loginBody } = await fresh.login(bobKey)
check('bob logs in with passkey', loginRes.status, 200)
check('new session is bob', (await fresh.req('GET', '/api/me')).data.name, 'Bob')
check('replayed login response is rejected', (await new Client('replay').req('POST', '/api/webauthn/authenticate', loginBody)).status, 400)
check('unknown passkey -> 401', (await new Client('x').login(new Authenticator())).res.status, 401)
bobKey.flags = 0x01 // user present, not verified
check('login without user verification -> 401', (await new Client('x').login(bobKey)).res.status, 401)
bobKey.flags = 0x05

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
check('passkey without user verification is rejected -> 400', (await laptop.registerPasskey(new Authenticator({ userVerified: false }), { userName: 'Bob' })).status, 400)
const bobLaptopKey = new Authenticator()
check('logged-in bob adds a passkey on the laptop', (await laptop.registerPasskey(bobLaptopKey, { userName: 'Bob' })).status, 200)
check('bob now has two passkeys', (await bob.req('GET', '/api/me/passkeys')).data.length, 2)
check('the laptop passkey logs in as bob', (await (async () => { const c = new Client('x'); await c.login(bobLaptopKey); return (await c.req('GET', '/api/me')).data.name })()), 'Bob')
await admin.registerPasskey(new Authenticator(), { userName: 'Admin' })
check("admin cannot delete bob's passkey -> 404", (await admin.req('DELETE', `/api/me/passkeys/${bobPasskeyId}`)).status, 404)
check('bob deletes his first passkey', (await bob.req('DELETE', `/api/me/passkeys/${bobPasskeyId}`)).status, 204)
check('deleted passkey cannot log in', (await new Client('x').login(bobKey)).res.status, 401)
check('deleting a passkey keeps this session', (await bob.req('GET', '/api/me')).status, 200)
check('deleting a passkey logs out the other devices', (await laptop.req('GET', '/api/me')).status, 401)
check('... including device-link sessions', (await recovered.req('GET', '/api/me')).status, 401)
check('... and the session endpoint says so too', (await fresh.req('GET', '/api/_auth/session')).status, 401)

console.log('# log out everywhere else')
const phone = new Client('bob-phone')
await phone.login(bobLaptopKey)
check('bob logs in again on another device', (await phone.req('GET', '/api/me')).status, 200)
check('log out everywhere else needs a session -> 401', (await anon.req('POST', '/api/me/sessions/end-others')).status, 401)
const phoneCookie = phone.cookie
check('bob logs out everywhere else', (await bob.req('POST', '/api/me/sessions/end-others')).status, 204)
check('the device that asked stays logged in', (await bob.req('GET', '/api/me')).data.name, 'Bob')
check('the other device is logged out', (await phone.req('GET', '/api/lists')).status, 401)
await new Client('x').login(bobLaptopKey)
phone.cookie = phoneCookie // the 401 cleared it; send the revoked cookie itself again
check('the revoked cookie stays out after a new login elsewhere', (await phone.req('GET', '/api/me')).status, 401)

console.log('# admin')
const usersList = (await admin.req('GET', '/api/admin/users')).data
check('admin lists 3 users', usersList.length, 3)
const carolUser = usersList.find((u) => u.name === 'Carol')
check('admin cannot delete self -> 400', (await admin.req('DELETE', `/api/admin/users/${adminMe.id}`)).status, 400)
check('admin deletes carol', (await admin.req('DELETE', `/api/admin/users/${carolUser.id}`)).status, 204)
check("deleted user's session is rejected -> 401", (await carol.req('GET', '/api/me')).status, 401)
check('deleted user cannot log in', (await new Client('x').login(carolKey)).res.status, 401)

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
