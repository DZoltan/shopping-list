// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      // Generate the deploy config from wrangler.jsonc so `wrangler deploy` works from the repo root
      deployConfig: true,
      nodeCompat: true,
    },
  },
})
