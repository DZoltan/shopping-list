// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // tests/run-e2e.mjs builds into a temporary directory, so it can run next to your `npm run dev`
  buildDir: process.env.E2E_BUILD_DIR || undefined,
  modules: ['@nuxt/ui', '@vite-pwa/nuxt', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],

  auth: {
    webAuthn: true,
  },

  runtimeConfig: {
    // Set in production with `wrangler secret put NUXT_SESSION_PASSWORD` (min. 32 chars)
    session: {
      maxAge: 60 * 60 * 24 * 180,
    },
    // One-time token for creating the first admin at /setup (`wrangler secret put NUXT_ADMIN_SETUP_TOKEN`)
    adminSetupToken: '',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'hu' },
      title: 'Listák',
      meta: [
        { name: 'theme-color', content: '#16a34a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
      ],
    },
  },

  icon: {
    // Bundle only the icons the app uses instead of a whole collection in the Worker
    serverBundle: false,
    clientBundle: { scan: true, sizeLimitKb: 256 },
  },

  pwa: {
    registerType: 'autoUpdate',
    // Browsers fetch the manifest without cookies by default, which Cloudflare Access would block
    useCredentials: true,
    manifest: {
      name: 'Listák',
      short_name: 'Listák',
      description: 'Közös bevásárló- és teendőlista',
      lang: 'hu',
      start_url: '/',
      display: 'standalone',
      theme_color: '#16a34a',
      background_color: '#ffffff',
    },
    // Icons and head links are generated from public/icon.svg (see pwa-assets.config.ts)
    pwaAssets: { config: true },
    workbox: {
      // Pages are rendered on the server, so there is no precached app shell to fall back to
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,png,svg,ico,woff2}'],
      // Help screenshots are loaded only when someone opens the help page
      globIgnores: ['**/help-images/**'],
      runtimeCaching: [
        {
          // Pages and API reads: always try the network, fall back to the last copy when offline
          urlPattern: ({ request, url }) =>
            request.mode === 'navigate' || (url.pathname.startsWith('/api/') && request.method === 'GET'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages-and-api',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 50 },
          },
        },
      ],
    },
    client: { installPrompt: true },
  },

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      // Generate the deploy config from wrangler.jsonc so `wrangler deploy` works from the repo root
      deployConfig: true,
      nodeCompat: true,
      // Local D1 data for `npm run dev`; tests/run-e2e.mjs points this at a throwaway directory
      dev: { persistDir: process.env.CF_PERSIST_DIR || undefined },
    },
  },
})
