// Software passkey authenticator (ES256, "none" attestation) and a cookie-keeping API client,
// shared by tests/auth.e2e.mjs and scripts/help-screenshots.mjs.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'

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

export function createPasskeyKit(base) {
  const RP_ID = new URL(base).hostname
  const ORIGIN = new URL(base).origin

  class Authenticator {
    // userVerified: false acts like a security key without a PIN (only "user present" is set)
    constructor({ userVerified = true } = {}) {
      this.flags = userVerified ? 0x05 : 0x01
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
        sha256(RP_ID), Buffer.from([this.flags | 0x40]), Buffer.alloc(4), Buffer.alloc(16),
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
      const authData = Buffer.concat([sha256(RP_ID), Buffer.from([this.flags]), counter])
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
      const res = await fetch(base + path, {
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

  return { Authenticator, Client }
}
