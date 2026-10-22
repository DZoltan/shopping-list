<script setup lang="ts">
// In-app browsers (Messenger, Facebook, Instagram, other Android WebViews) do not support passkeys:
// on Android the call simply never returns. They also keep their own cookies, so a login there
// would not carry over to the real browser. Detect them and send the user to a real browser.
const toast = useToast()
const app = ref<string>()
const platform = ref<'android' | 'ios' | 'other'>('other')
const href = ref('')

onMounted(() => {
  const ua = navigator.userAgent
  platform.value = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'other'
  href.value = window.location.href

  if (/Messenger|FB_IAB\/MESSENGER|Orca-Android/i.test(ua)) app.value = 'Messenger'
  else if (/Instagram/i.test(ua)) app.value = 'Instagram'
  else if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) app.value = 'Facebook'
  // Generic Android WebView marker, e.g. Gmail or other apps opening links inside themselves
  else if (platform.value === 'android' && /; wv\)/.test(ua)) app.value = 'egy alkalmazás'
})

const title = computed(() => {
  if (app.value === 'egy alkalmazás') return 'Ezt az oldalt egy alkalmazás beépített böngészője nyitotta meg'
  const article = app.value && /^[aeiouáéíóöőúüű]/i.test(app.value) ? 'az' : 'a'
  return `Ezt az oldalt ${article} ${app.value} beépített böngészője nyitotta meg`
})

// Android: an intent URL opens the same page in Chrome, falling back to the plain URL
const chromeIntent = computed(() => {
  if (!href.value) return ''
  const url = new URL(href.value)
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href.value)};end`
})
// iOS 17+: hands the page to Safari; on older versions nothing happens and the steps below still apply
const safariUrl = computed(() => href.value.replace(/^https:\/\//, 'x-safari-https://'))

async function copy() {
  await navigator.clipboard.writeText(href.value)
  toast.add({ title: 'Link kimásolva, illeszd be a böngészőbe', color: 'success' })
}
</script>

<template>
  <UAlert
    v-if="app"
    color="warning"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    :title="title"
    class="mb-6"
  >
    <template #description>
      <p>Itt nem működik a passkey. Nyisd meg az oldalt a rendes böngésződben.</p>
      <p v-if="platform === 'ios'" class="mt-1">
        Ha a gomb nem működik: koppints a <strong>···</strong> vagy a megosztás ikonra, és válaszd a
        <strong>Megnyitás Safariban</strong> lehetőséget.
      </p>
      <p v-else-if="platform === 'android'" class="mt-1">
        Ha a gomb nem működik: koppints a <strong>⋮</strong> menüre, és válaszd a
        <strong>Megnyitás böngészőben</strong> lehetőséget.
      </p>
    </template>
    <template #actions>
      <UButton v-if="platform === 'android'" :to="chromeIntent" external icon="i-lucide-external-link" label="Megnyitás Chrome-ban" />
      <UButton v-else-if="platform === 'ios'" :to="safariUrl" external icon="i-lucide-compass" label="Megnyitás Safariban" />
      <UButton icon="i-lucide-copy" label="Link másolása" variant="outline" @click="copy" />
    </template>
  </UAlert>
</template>
