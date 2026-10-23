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

// npx starts a process tree (shell -> npx -> nuxt); stop all of it, not just the shell
function stop(child) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid, 'SIGTERM') // the whole process group, see `detached` below
}

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    // Ready means the DB answers, not just any JSON (errors are JSON too)
    const ready = await fetch(`${BASE}/api/health`)
      .then((r) => r.ok && r.headers.get('content-type')?.includes('json'))
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
    // On Linux/macOS: own process group, so stop() can end the whole tree
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      CF_PERSIST_DIR: join(stateDir, 'v3'),
      NUXT_ADMIN_SETUP_TOKEN: SETUP_TOKEN,
      NUXT_DATA_KEY: 'e2e-data-key-0123456789abcdef0123456789',
      // Own build directory, so a running `npm run dev` is neither blocked nor overwritten.
      // It must stay inside the project, or the Cloudflare dev emulation loses the D1 binding.
      E2E_BUILD_DIR: '.nuxt-e2e',
      NUXT_IGNORE_LOCK: '1',
    },
  })
  await waitForServer()

  // E2E_STATE_DIR lets a test read the database directly (tests/auth.e2e.mjs checks what is stored)
  await run('node', [script, BASE, SETUP_TOKEN, ...extraArgs.map((a) => `"${a}"`)], { env: { ...process.env, E2E_STATE_DIR: stateDir } })
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
