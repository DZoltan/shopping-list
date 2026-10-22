<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ListType } from '#shared/constants'
import { createListSchema } from '#shared/schemas'

const props = defineProps<{ type: ListType, households: { id: number, name: string }[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [id: number] }>()

const toast = useToast()
const schema = createListSchema.pick({ name: true })
const state = reactive<{ name: string, householdId?: number }>({ name: '' })
const pending = ref(false)

// Reset each time it opens, preselecting the first household
watch(open, (isOpen) => {
  if (isOpen) Object.assign(state, { name: '', householdId: props.households[0]?.id })
})

async function submit(event: FormSubmitEvent<{ name: string }>) {
  pending.value = true
  try {
    const list = await $fetch('/api/lists', {
      method: 'POST',
      body: { type: props.type, name: event.data.name, householdId: state.householdId },
    })
    open.value = false
    emit('created', list.id)
  } catch {
    toast.add({ title: 'Nem sikerült létrehozni a listát', color: 'error' })
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="type === 'shopping' ? 'Új bevásárlólista' : 'Új teendőlista'">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
        <UFormField label="Név" name="name">
          <UInput v-model="state.name" :placeholder="LIST_TYPE_META[type].newListPlaceholder" class="w-full" autofocus />
        </UFormField>
        <UFormField v-if="households.length > 1" label="Háztartás">
          <USelect
            v-model="state.householdId"
            :items="households.map((h) => ({ label: h.name, value: h.id }))"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton label="Mégse" variant="ghost" color="neutral" @click="open = false" />
          <UButton type="submit" label="Létrehozás" icon="i-lucide-plus" :loading="pending" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
