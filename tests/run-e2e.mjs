// Runs an e2e script against a dev server with its own, empty local database,
// so the data in .wrangler/state (your `npm run dev` data) is never touched.
//
//   npm run test:e2e                      -> tests/auth.e2e.mjs
//   node tests/run-e2e.mjs <script> [...]  -> any script; gets <baseUrl> <setupToken> [...] as arguments
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 3199
const BASE = `http://localhost:${PORT}`
const SETUP_TOKEN = 'e2e-setup-token-0123456789abcdef'
const [script = 'tests/auth.e2e.mjs', ...extraArgs] = process.argv.slice(2)

// wrangler --persist-to <dir> stores D1 under <dir>/v3, which is what Nitro's persistDir points at
const stateDir = mkdtempSync(join(tmpdir(), 'shopping-e2e-'))

// With shell: true (needed for npx on Windows) Node wants one command line, not separate args
const shell = (command, args, options = {}) => spawn([command, ...args].join(' '), { shell: true, ...options })

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = shell(command, args, { stdio: 'inherit', ...options })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))))
  })
}

function stop(child) {
  // npx starts a process tree on Windows; kill all of it
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    const ready = await fetch(`${BASE}/api/health`)
      .then((r) => r.headers.get('content-type')?.includes('json'))
      .catch(() => false)
    if (ready) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Dev server did not start')
}

let server
let exitCode = 1
try {
  await run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', `"${stateDir}"`], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })

  server = shell('npx', ['nuxt', 'dev', '--port', String(PORT)], {
    stdio: 'ignore',
    env: { ...process.env, CF_PERSIST_DIR: join(stateDir, 'v3'), NUXT_ADMIN_SETUP_TOKEN: SETUP_TOKEN },
  })
  await waitForServer()

  await run('node', [script, BASE, SETUP_TOKEN, ...extraArgs.map((a) => `"${a}"`)])
  exitCode = 0
} catch (error) {
  console.error(error.message)
} finally {
  if (server) stop(server)
  // Give the server a moment to release the database files before removing them
  await new Promise((r) => setTimeout(r, 1500))
  rmSync(stateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
process.exit(exitCode)
