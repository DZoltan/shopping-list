// Field-level encryption for user content (names, list and item texts): someone with access to the
// database (dashboard, export, leaked API token) but not to the Worker secret NUXT_DATA_KEY sees no text.
// Drizzle column types convert values synchronously and WebCrypto is async only, so this uses the
// audited pure-JS @noble libraries, which run on Workers.
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes } from '@noble/ciphers/utils.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { customType } from 'drizzle-orm/sqlite-core'

// Stored as "v1:" + base64url(nonce || ciphertext || tag); the version allows a later key change
export const CIPHER_PREFIX = 'v1:'
// Stored as "h1:" + base64url(HMAC-SHA256)
export const INDEX_PREFIX = 'h1:'
// XChaCha20-Poly1305: a random 24-byte nonce never realistically repeats, and in pure JS it is
// about twice as fast as AES-GCM (400 decrypts take ~3 ms, Workers Free allows 10 ms CPU per request)
const NONCE_BYTES = 24

let keys: { secret: string, encrypt: Uint8Array, index: Uint8Array } | undefined

// Called by useDb (server/utils/db.ts) with the secret from the runtime config
export function setDataKey(secret: string) {
  if (keys?.secret === secret) return
  if (secret.length < 32) throw new Error('NUXT_DATA_KEY is missing or shorter than 32 characters')
  const material = new TextEncoder().encode(secret)
  keys = {
    secret,
    // Separate keys for the two uses, both derived from the one secret
    encrypt: hkdf(sha256, material, undefined, new TextEncoder().encode('listak/encrypt/v1'), 32),
    index: hkdf(sha256, material, undefined, new TextEncoder().encode('listak/index/v1'), 32),
  }
}

function requireKeys() {
  if (!keys) throw new Error('Data key is not set')
  return keys
}

export function encrypt(text: string) {
  const nonce = randomBytes(NONCE_BYTES)
  const sealed = xchacha20poly1305(requireKeys().encrypt, nonce).encrypt(new TextEncoder().encode(text))
  const bytes = new Uint8Array(NONCE_BYTES + sealed.length)
  bytes.set(nonce)
  bytes.set(sealed, NONCE_BYTES)
  return CIPHER_PREFIX + toBase64Url(bytes)
}

export function decrypt(value: string) {
  // Written before encryption existed; POST /api/admin/encrypt-existing converts these
  if (!value.startsWith(CIPHER_PREFIX)) return value
  const bytes = fromBase64Url(value.slice(CIPHER_PREFIX.length))
  const plain = xchacha20poly1305(requireKeys().encrypt, bytes.subarray(0, NONCE_BYTES)).decrypt(bytes.subarray(NONCE_BYTES))
  return new TextDecoder().decode(plain)
}

// Same input, same output: can be compared and kept unique, but not turned back into text
export function blindIndex(text: string) {
  return INDEX_PREFIX + toBase64Url(hmac(sha256, requireKeys().index, new TextEncoder().encode(text)))
}

// --- column types: routes read and write plain strings, the database only sees the stored form ---

export const encryptedText = customType<{ data: string, driverData: string }>({
  dataType: () => 'text',
  toDriver: encrypt,
  fromDriver: decrypt,
})

// Reads return the stored index as is; compute the plain value from the decrypted text instead
export const blindIndexText = customType<{ data: string, driverData: string }>({
  dataType: () => 'text',
  toDriver: blindIndex,
  fromDriver: (value) => value,
})

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
