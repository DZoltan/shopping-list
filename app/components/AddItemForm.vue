<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import type { ListType } from '#shared/constants'
import { createItemSchema } from '#shared/schemas'
import { normalizeItemText } from '#shared/text'

type NewItem = z.output<typeof createItemSchema>
type Suggestion = { id: number, text: string, normalized: string, lastQuantity: string | null, useCount: number }

const props = defineProps<{
  type: ListType
  suggestions: Suggestion[]
  // Normalized texts of the open items, which are not suggested again
  onList: Set<string>
}>()
const emit = defineEmits<{ add: [item: NewItem], forget: [id: number] }>()

const MAX_MATCHES = 6
const MAX_CHIPS = 8

const state = reactive({ text: '', quantity: '', reason: '' })
const showDetails = ref(false)
const focused = ref(false)
const highlighted = ref(-1)

const available = computed(() => props.suggestions.filter((s) => !props.onList.has(s.normalized)))
// Matches while typing: words starting with the query first, then anywhere in the text
const matches = computed(() => {
  const q = normalizeItemText(state.text)
  if (!q) return []
  const starts = available.value.filter((s) => s.normalized.startsWith(q) || s.normalized.includes(` ${q}`))
  const contains = available.value.filter((s) => !starts.includes(s) && s.normalized.includes(q))
  return [...starts, ...contains].filter((s) => s.normalized !== q).slice(0, MAX_MATCHES)
})
const chips = computed(() => available.value.slice(0, MAX_CHIPS))
const dropdownOpen = computed(() => focused.value && matches.value.length > 0)
watch(matches, () => { highlighted.value = -1 })

function reset() {
  Object.assign(state, { text: '', quantity: '', reason: '' })
  highlighted.value = -1
}

function submit(event: FormSubmitEvent<NewItem>) {
  emit('add', event.data)
  reset()
}

function pick(s: Suggestion) {
  emit('add', { text: s.text, quantity: props.type === 'shopping' ? s.lastQuantity : null, reason: null })
  reset()
}

// Arrow keys move through the suggestions; Enter picks one only if it was moved to
function onKeydown(e: KeyboardEvent) {
  if (!dropdownOpen.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlighted.value = (highlighted.value + 1) % matches.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlighted.value = highlighted.value <= 0 ? matches.value.length - 1 : highlighted.value - 1
  } else if (e.key === 'Enter' && highlighted.value >= 0) {
    e.preventDefault()
    pick(matches.value[highlighted.value]!)
  } else if (e.key === 'Escape') {
    focused.value = false
  }
}

// Delay closing on blur, so a tap on a suggestion still lands
function onBlur() {
  setTimeout(() => { focused.value = false }, 150)
}
</script>

<template>
  <UForm :schema="createItemSchema" :state="state" class="space-y-2" @submit="submit">
    <div class="flex items-start gap-2">
      <UFormField name="text" class="relative flex-1">
        <UInput
          v-model="state.text"
          :placeholder="LIST_TYPE_META[type].itemPlaceholder"
          aria-label="Új tétel"
          class="w-full"
          size="lg"
          icon="i-lucide-plus"
          autocomplete="off"
          role="combobox"
          :aria-expanded="dropdownOpen"
          aria-controls="item-suggestions"
          @focus="focused = true"
          @blur="onBlur"
          @keydown="onKeydown"
        />
        <ul
          v-if="dropdownOpen"
          id="item-suggestions"
          role="listbox"
          class="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-default bg-default shadow-lg"
        >
          <li
            v-for="(s, index) in matches"
            :key="s.id"
            role="option"
            :aria-selected="index === highlighted"
            class="flex items-center gap-2 pr-1"
            :class="index === highlighted ? 'bg-elevated' : 'hover:bg-elevated/60'"
          >
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left" @mousedown.prevent @click="pick(s)">
              <UIcon name="i-lucide-history" class="size-4 shrink-0 text-dimmed" />
              <span class="truncate">{{ s.text }}</span>
              <UBadge v-if="type === 'shopping' && s.lastQuantity" :label="s.lastQuantity" variant="subtle" size="sm" />
              <span class="ml-auto shrink-0 text-xs text-dimmed">{{ s.useCount }}×</span>
            </button>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="xs"
              :aria-label="`${s.text} elfelejtése`"
              @mousedown.prevent
              @click="emit('forget', s.id)"
            />
          </li>
        </ul>
      </UFormField>
      <UButton
        :icon="showDetails ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
        variant="ghost"
        color="neutral"
        size="lg"
        :aria-label="showDetails ? 'Részletek elrejtése' : 'Részletek'"
        @click="showDetails = !showDetails"
      />
      <UButton type="submit" label="Hozzáadás" size="lg" class="hidden sm:inline-flex" />
      <UButton type="submit" icon="i-lucide-arrow-up" size="lg" aria-label="Hozzáadás" class="sm:hidden" />
    </div>

    <div v-if="showDetails" class="grid gap-2 sm:grid-cols-[12rem_1fr]">
      <UFormField v-if="type === 'shopping'" name="quantity">
        <UInput v-model="state.quantity" placeholder="Mennyiség, pl. 2 kg" class="w-full" />
      </UFormField>
      <UFormField name="reason" :class="type === 'shopping' ? '' : 'sm:col-span-2'">
        <UInput v-model="state.reason" placeholder="Miért? (opcionális)" class="w-full" />
      </UFormField>
    </div>

    <!-- Frequent items, one tap to add; only while nothing is typed -->
    <div v-if="!state.text && chips.length" class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-muted">Gyakori:</span>
      <UButton
        v-for="s in chips"
        :key="s.id"
        :label="type === 'shopping' && s.lastQuantity ? `${s.text} · ${s.lastQuantity}` : s.text"
        icon="i-lucide-plus"
        size="xs"
        variant="soft"
        color="neutral"
        class="rounded-full"
        @click="pick(s)"
      />
    </div>
  </UForm>
</template>
