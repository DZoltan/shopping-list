<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{ url: string, expiresAt: string, hint?: string }>()
const emit = defineEmits<{ expired: [] }>()

const toast = useToast()
// White background in both themes: phone cameras read dark-on-light codes most reliably
const qrSvg = computed(() => renderSVG(props.url, { border: 2 }))

// Countdown until the link stops working
const now = ref(Date.now())
const remainingMs = computed(() => Math.max(0, new Date(props.expiresAt).getTime() - now.value))
const remaining = computed(() => {
  const totalMinutes = Math.ceil(remainingMs.value / 60000)
  if (totalMinutes > 90) return `${Math.round(totalMinutes / 60)} óra`
  const s = Math.floor(remainingMs.value / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
    if (remainingMs.value === 0) {
      clearInterval(timer)
      emit('expired')
    }
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const canShare = computed(() => import.meta.client && 'share' in navigator)

async function copy() {
  await navigator.clipboard.writeText(props.url)
  toast.add({ title: 'Link kimásolva', color: 'success' })
}

async function share() {
  try {
    await navigator.share({ title: 'Belépés a Listák appba', url: props.url })
  } catch {
    // The user closed the share sheet
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4 rounded-lg border border-default p-4 sm:flex-row sm:items-start">
    <!-- eslint-disable-next-line vue/no-v-html -- SVG generated locally by uqr from our own URL -->
    <div class="size-44 shrink-0 overflow-hidden rounded-md bg-white [&>svg]:size-full" v-html="qrSvg" />
    <div class="min-w-0 flex-1 space-y-3 text-center sm:text-left">
      <p v-if="hint" class="text-sm text-muted">{{ hint }}</p>
      <p class="break-all rounded bg-elevated px-2 py-1 font-mono text-xs">{{ url }}</p>
      <div class="flex flex-wrap justify-center gap-2 sm:justify-start">
        <UButton icon="i-lucide-copy" label="Link másolása" variant="outline" size="sm" @click="copy" />
        <UButton v-if="canShare" icon="i-lucide-share-2" label="Megosztás" variant="outline" size="sm" @click="share" />
      </div>
      <p class="text-sm" :class="remainingMs ? 'text-muted' : 'text-error'">
        {{ remainingMs ? `Hátralévő idő: ${remaining} · egyszer használható` : 'A link lejárt.' }}
      </p>
    </div>
  </div>
</template>
