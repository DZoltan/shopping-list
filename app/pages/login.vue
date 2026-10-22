<script setup lang="ts">
useHead({ title: 'Belépés' })

const route = useRoute()
const { authenticate, isSupported } = useWebAuthn()
const { fetch: refreshSession } = useUserSession()

const pending = ref(false)
const error = ref<string>()

// Only follow local redirects, never to another site
const redirect = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/'
})

async function login() {
  pending.value = true
  error.value = undefined
  try {
    await authenticate()
    await refreshSession()
    await navigateTo(redirect.value)
  } catch (e) {
    error.value = passkeyErrorMessage(e)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[60dvh] max-w-sm flex-col justify-center gap-6 text-center">
    <div class="space-y-2">
      <img src="/icon.svg" alt="" class="mx-auto size-16">
      <h1 class="text-2xl font-semibold">Listák</h1>
      <p class="text-muted">Lépj be a passkey-ddel (ujjlenyomat, arcfelismerés vagy PIN).</p>
    </div>

    <UButton
      size="xl"
      block
      icon="i-lucide-fingerprint"
      label="Belépés passkey-vel"
      :loading="pending"
      :disabled="!isSupported"
      @click="login"
    />

    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert
      v-else-if="!isSupported"
      color="warning"
      variant="subtle"
      description="Ez a böngésző nem támogatja a passkey-t. Próbáld egy frissebb böngészővel."
    />

    <p class="text-sm text-muted">
      Még nincs fiókod? A belépéshez meghívó link kell valakitől, aki már használja az appot.
    </p>
  </div>
</template>
