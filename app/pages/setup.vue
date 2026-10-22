<script setup lang="ts">
import { householdNameSchema } from '#shared/schemas'

useHead({ title: 'Első beállítás' })

const { register, isSupported } = useWebAuthn()
const { fetch: refreshSession } = useUserSession()
const { data: status } = await useFetch('/api/auth/setup-status')

const form = reactive({ setupToken: '', name: '', householdName: 'Otthon' })
const pending = ref(false)
const error = ref<string>()

async function setup() {
  const name = form.name.trim()
  const householdName = householdNameSchema.safeParse(form.householdName)
  if (!name || !form.setupToken) {
    error.value = 'Add meg a setup tokent és a neved.'
    return
  }
  pending.value = true
  error.value = undefined
  try {
    await register({
      userName: name,
      displayName: name,
      setupToken: form.setupToken.trim(),
      householdName: householdName.success ? householdName.data : undefined,
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    error.value = passkeyErrorMessage(e)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-6 py-6">
    <div class="space-y-2 text-center">
      <UIcon name="i-lucide-key-round" class="size-12 text-primary" />
      <h1 class="text-2xl font-semibold">Első beállítás</h1>
      <p v-if="status?.needed" class="text-muted">Hozd létre az admin fiókot. Ezt csak egyszer lehet megtenni.</p>
    </div>

    <form v-if="status?.needed" class="space-y-4" @submit.prevent="setup">
      <UFormField label="Setup token" description="Amit a NUXT_ADMIN_SETUP_TOKEN secretnek adtál meg.">
        <UInput v-model="form.setupToken" type="password" class="w-full" autocomplete="off" />
      </UFormField>
      <UFormField label="A neved">
        <UInput v-model="form.name" class="w-full" autocomplete="name" />
      </UFormField>
      <UFormField label="A háztartásod neve">
        <UInput v-model="form.householdName" class="w-full" />
      </UFormField>
      <UButton
        type="submit"
        size="xl"
        block
        icon="i-lucide-fingerprint"
        label="Passkey létrehozása"
        :loading="pending"
        :disabled="!isSupported"
      />
      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    </form>

    <div v-else class="space-y-4 text-center">
      <p class="text-muted">A beállítás már megtörtént.</p>
      <UButton to="/login" label="Belépés" />
    </div>
  </div>
</template>
