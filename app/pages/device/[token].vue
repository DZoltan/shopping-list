<script setup lang="ts">
useHead({ title: 'Belépés' })

const route = useRoute()
const token = String(route.params.token)
const { register, isSupported } = useWebAuthn()
const { fetch: refreshSession } = useUserSession()

// Only looks the link up; logging in needs the button below (link previews must not use it up)
const { data: link, error: lookupError } = await useFetch('/api/device-links/lookup', { query: { token } })

const step = ref<'confirm' | 'passkey'>('confirm')
const pending = ref(false)
const error = ref<string>()

async function redeem() {
  pending.value = true
  error.value = undefined
  try {
    await $fetch('/api/device-links/redeem', { method: 'POST', body: { token } })
    await refreshSession()
    if (isSupported.value) step.value = 'passkey'
    else await navigateTo('/')
  } catch {
    error.value = 'A link már nem érvényes. Készíts újat a másik eszközön.'
  } finally {
    pending.value = false
  }
}

async function createPasskey() {
  if (!link.value) return
  pending.value = true
  error.value = undefined
  try {
    await register({ userName: link.value.name, displayName: link.value.name })
    await navigateTo('/')
  } catch (e) {
    error.value = passkeyErrorMessage(e)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-6 py-6 text-center">
    <template v-if="link && step === 'confirm'">
      <UIcon name="i-lucide-monitor-smartphone" class="size-12 text-primary" />
      <h1 class="text-2xl font-semibold">Belépés ezen az eszközön</h1>
      <p class="text-muted">A link <strong>{{ link.name }}</strong> fiókjába léptet be.</p>
      <UButton size="xl" block icon="i-lucide-log-in" :label="`Belépés mint ${link.name}`" :loading="pending" @click="redeem" />
    </template>

    <template v-else-if="step === 'passkey'">
      <UIcon name="i-lucide-fingerprint" class="size-12 text-primary" />
      <h1 class="text-2xl font-semibold">Be vagy jelentkezve</h1>
      <p class="text-muted">Hozz létre passkey-t ezen az eszközön, hogy legközelebb link nélkül is be tudj lépni.</p>
      <UButton size="xl" block icon="i-lucide-fingerprint" label="Passkey létrehozása" :loading="pending" @click="createPasskey" />
      <UButton variant="ghost" color="neutral" label="Most kihagyom" to="/" />
    </template>

    <template v-else-if="lookupError">
      <UIcon name="i-lucide-link-2-off" class="size-12 text-muted" />
      <h1 class="text-xl font-semibold">Ez a link nem érvényes</h1>
      <p class="text-muted">Lehet, hogy lejárt vagy már felhasználták. Készíts újat a profilodban egy bejelentkezett eszközön.</p>
      <UButton to="/login" variant="ghost" label="Belépés passkey-vel" />
    </template>

    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
  </div>
</template>
