# CLAUDE.md

## Project
Household shopping-list / to-do web app. Personal, non-commercial, tiny traffic.
Goal: run entirely on free tiers, with no cold starts and no auto-pausing services.

## Stack
- **Framework:** Nuxt (Vue 3, TypeScript, Nitro server). Check `package.json` for the exact version and follow that version's directory layout (`app/` vs. root-level `pages/`).
- **Hosting:** Cloudflare Workers (Workers Free plan) via the Nitro Cloudflare preset (`cloudflare_module`), static assets served by Cloudflare.
- **Database:** Cloudflare D1 (SQLite), accessed through a binding named `DB`. No Supabase, no external DB.
- **ORM / migrations:** Drizzle ORM + drizzle-kit for schema and SQL migrations; migrations are applied with `wrangler d1 migrations apply`.
- **Package manager:** use whatever lockfile is in the repo; do not switch.
- **TypeScript:** pinned to 6.x. TypeScript 7 (native) breaks `vue-tsc` / `nuxt typecheck`; do not upgrade until vue-tsc supports it.
- **Install scripts:** npm blocks dependency install scripts unless listed in `allowScripts` in `package.json` (currently esbuild and workerd, which download native binaries). If a dependency update adds a new version of them, approve it with `npm approve-scripts <pkg>`.
- **Local dev:** with the `cloudflare_module` preset, Nitro emulates the bindings from `wrangler.jsonc` during `npm run dev` (local state in `.wrangler/state/v3`). No extra module is needed.

## Hard constraints
- **No WebSockets, no Socket.IO, no Durable Objects, no realtime.** Data comes from plain DB queries through Nuxt server routes. If live-ish updates are needed, use refetching (`refresh()` on focus / manual refresh / light polling), not sockets.
- **Must run on the Workers runtime** (V8 isolate, not a full Node process). Do not add dependencies that need native modules, the filesystem, or Node-only APIs. Before adding any package, check it works on Workers (`nodejs_compat` flag is acceptable if needed).
- **Stay inside the free tier:**
  - D1 free: 5 GB total, 5M rows read/day, 100k rows written/day. Always index columns used in `WHERE` / `ORDER BY` / joins; avoid full table scans, because every scanned row counts as a row read.
  - Workers Free: 100k requests/day, limited CPU time per request and a small number of subrequests per invocation. Keep handlers thin, batch D1 statements (`db.batch`) instead of many separate queries.
- Never introduce a paid service or one that needs a credit card without asking first.

## Architecture rules
- Server routes live in `server/api/` and are the only place that touches the DB. Components and pages never talk to D1 directly.
- Get the D1 binding from the request context (`event.context.cloudflare.env.DB`) and wrap it with Drizzle in one shared helper (e.g. `server/utils/db.ts`); do not create the client ad hoc in each route.
- Validate all request bodies and query params on the server (e.g. with zod) before they reach the DB.
- Schema is the single source of truth in `server/db/schema.ts`. Never edit the database by hand; every schema change goes through a generated migration file that is committed.
- Use `useFetch` / `useAsyncData` for reads and `$fetch` for mutations. Keep shared types between server and client in one place.
- In Nuxt 4, `useFetch` / `useAsyncData` `data` is a `shallowRef`: mutating nested fields (`data.value.items.push(...)`, `item.done = true`) does not update the UI. Assign a new object instead (`data.value = { ...data.value, items: [...] }`).

## Commands
- Dev server: `npm run dev` (D1 runs locally via the Wrangler/Miniflare platform proxy; local data is separate from production).
- Generate migration: `npx drizzle-kit generate`
  - Renames (column/table) make drizzle-kit prompt interactively, which fails without a TTY. Instead: change the schema, run `npx drizzle-kit generate --custom --name <name>`, write the SQL by hand, and update the new `meta/<n>_snapshot.json` to the renamed state. `npx drizzle-kit generate` must then report no changes.
- Apply migrations locally: `npx wrangler d1 migrations apply DB --local`
- Apply migrations to production: `npx wrangler d1 migrations apply DB --remote`
- Build: `npm run build`
- Deploy: `npx wrangler deploy` (or the Git-connected Cloudflare build, if configured)
- Always run the local migration and a type check / build before suggesting a deploy.

## Working agreement
- Never run `--remote` migrations or deploys without asking me first.
- Do not delete or recreate tables that contain data; write a proper migration instead.
- No authentication is decided yet. Ask me before adding any auth approach.
- Prefer small, reviewable changes. Explain non-obvious Nuxt/Vue concepts in a sentence or two: I am an experienced backend developer (Java, Python) but new to Nuxt/Vue and Node.
- Communicate with me in Hungarian. Write code, comments, commit messages and this file in English.