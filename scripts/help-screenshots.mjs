// Regenerates the screenshots of the help page (public/help-images/*.webp) with headless Edge or Chrome.
// Run it through the e2e runner, so it gets its own throwaway database:
//   node tests/run-e2e.mjs scripts/help-screenshots.mjs
// Optional: BROWSER=<path to msedge.exe / chrome.exe>
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { createPasskeyKit } from '../tests/lib/passkey.mjs'

const [BASE, SETUP_TOKEN] = process.argv.slice(2)
const OUT = join(import.meta.dirname, '..', 'public', 'help-images')
const BROWSER = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p))
if (!BROWSER) throw new Error('No Edge or Chrome found; set BROWSER')
mkdirSync(OUT, { recursive: true })

// --- demo data: Anna and Bence share a household ---
const { Authenticator, Client } = createPasskeyKit(BASE)
const anna = new Client('anna')
const bence = new Client('bence')
await anna.registerPasskey(new Authenticator(), { userName: 'Anna', setupToken: SETUP_TOKEN, householdName: 'Otthon' })
const home = (await anna.req('GET', '/api/me')).data.households[0]
const invite = (await anna.req('POST', '/api/invites', { name: 'Bence', householdId: home.id, role: 'member' })).data
await bence.registerPasskey(new Authenticator(), { userName: 'Bence', inviteToken: invite.url.split('/invite/')[1] })

async function addList(type, name, items) {
  const list = (await anna.req('POST', '/api/lists', { type, name })).data
  for (const [text, opts = {}] of items) {
    const by = opts.by === 'bence' ? bence : anna
    const item = (await by.req('POST', `/api/lists/${list.id}/items`, { text, quantity: opts.quantity, reason: opts.reason })).data
    if (opts.done) await anna.req('PATCH', `/api/items/${item.id}`, { done: true })
  }
  return list
}
// Past purchases, so the suggestions have something to offer
const history = await addList('shopping', 'Múlt heti', [['tej', { quantity: '2 l' }], ['kenyér'], ['banán', { quantity: '1 kg' }], ['joghurt'], ['tej', { quantity: '2 l' }], ['kenyér'], ['paprika']])
await anna.req('DELETE', `/api/lists/${history.id}`)
const weekly = await addList('shopping', 'Heti nagybevásárlás', [
  ['tojás', { quantity: '10 db' }], ['paradicsom', { quantity: '1 kg', reason: 'lecsóhoz', by: 'bence' }], ['sajt'],
  ['tej', { quantity: '2 l', done: true }], ['kenyér', { done: true }],
])
await addList('shopping', 'Drogéria', [['fogkrém'], ['mosószer', { done: true }], ['papírtörlő']])
await addList('shopping', 'Hétvégi grill', [['csirkecomb', { quantity: '2 kg' }], ['kukorica'], ['faszén']])
await addList('todo', 'Ház körül', [['fűnyírás', { done: true }], ['ereszcsatorna takarítása'], ['kerítés festése', { by: 'bence' }]])
await addList('todo', 'Ügyintézés', [['autó műszaki vizsga'], ['csekkek befizetése', { done: true }]])

// --- browser over the DevTools protocol ---
const port = 9334
const profile = mkdtempSync(join(tmpdir(), 'help-shots-'))
const browser = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let wsUrl
for (let i = 0; i < 50 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 200))
  wsUrl = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((t) => t.find((x) => x.type === 'page')?.webSocketDebuggerUrl).catch(() => undefined)
}
const ws = new WebSocket(wsUrl)
await new Promise((r) => ws.addEventListener('open', r))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } })
const cdp = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const js = (expression) => cdp('Runtime.evaluate', { expression, awaitPromise: true })

await cdp('Network.enable')
const [cookieName, cookieValue] = anna.cookie.split('=')
await cdp('Network.setCookie', { name: cookieName, value: cookieValue, domain: new URL(BASE).hostname, path: '/' })
await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
// Hide the Nuxt devtools badge of the dev server and the browser's scrollbars
const hideDevtools = `(() => {
  document.querySelectorAll('#nuxt-devtools-container, nuxt-devtools-frame').forEach((e) => e.remove())
  const style = document.createElement('style')
  style.textContent = 'html { scrollbar-width: none } ::-webkit-scrollbar { display: none }'
  document.head.append(style)
})()`

async function shot(file, { path, width = 390, height = 760, mobile = true, before, type }) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile })
  if (path) {
    await cdp('Page.navigate', { url: BASE + path })
    await wait(3500)
  }
  if (before) {
    await js(before)
    await wait(1000)
  }
  // Real typing (focus + input events), like a user would
  if (type) {
    await cdp('Input.insertText', { text: type })
    await wait(800)
  }
  await js(hideDevtools)
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
  await sharp(Buffer.from(data, 'base64')).resize({ width: width * (mobile ? 1.5 : 1) }).webp({ quality: 78 }).toFile(join(OUT, `${file}.webp`))
  console.log('saved', file)
}

await shot('overview', { path: '/shopping' })
await shot('list', { path: `/shopping/${weekly.id}` })
await shot('suggestions', {
  path: `/shopping/${weekly.id}`,
  before: `document.querySelector('input[aria-label="Új tétel"]').focus()`,
  type: 'ba',
})
await shot('edit', {
  path: `/shopping/${weekly.id}`,
  before: `document.querySelector('button[aria-label$="szerkesztése"]').click()`,
})
await shot('desktop', { path: `/shopping/${weekly.id}`, width: 1280, height: 720, mobile: false })
await shot('household', { path: '/admin' })
await shot('device-link', {
  path: '/profile',
  // The link points at the throwaway test server; show a neutral, shortened one instead
  before: `(async () => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('QR-kód')).click()
    await new Promise((r) => setTimeout(r, 800))
    const url = [...document.querySelectorAll('p')].find((p) => p.textContent.includes('/device/'))
    if (url) url.textContent = 'https://…/device/Xk2…'
  })()`,
})

ws.close()
browser.kill()
await wait(500)
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
