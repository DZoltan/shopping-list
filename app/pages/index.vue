<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ListType } from '#shared/constants'
import { createListSchema } from '#shared/schemas'

const toast = useToast()
const { data: lists, refresh, status } = await useFetch('/api/lists', { default: () => [] })
useRefreshOnFocus(refresh)

const sections: { type: ListType, title: string, icon: string, placeholder: string }[] = [
  { type: 'shopping', title: 'Bevásárlólisták', icon: 'i-lucide-shopping-cart', placeholder: 'pl. Heti nagybevásárlás' },
  { type: 'todo', title: 'Teendők', icon: 'i-lucide-list-checks', placeholder: 'pl. Ház körül' },
]

const nameSchema = createListSchema.pick({ name: true })
const forms = reactive<Record<ListType, { name: string }>>({
  shopping: { name: '' },
  todo: { name: '' },
})

const listsOf = (type: ListType) => lists.value.filter((l) => l.type === type)

async function createList(type: ListType, event: FormSubmitEvent<{ name: string }>) {
  try {
    const list = await $fetch('/api/lists', { method: 'POST', body: { type, name: event.data.name } })
    forms[type].name = ''
    await navigateTo(`/lists/${list.id}`)
  } catch {
    toast.add({ title: 'Nem sikerült létrehozni a listát', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-8">
    <section v-for="section in sections" :key="section.type" class="space-y-3">
      <h2 class="flex items-center gap-2 text-lg font-semibold">
        <UIcon :name="section.icon" class="size-5 text-primary" />
        {{ section.title }}
      </h2>

      <ul v-if="listsOf(section.type).length" class="divide-y divide-default rounded-lg border border-default">
        <li v-for="list in listsOf(section.type)" :key="list.id">
          <NuxtLink
            :to="`/lists/${list.id}`"
            class="flex items-center justify-between px-4 py-3 hover:bg-elevated/50"
          >
            <span>{{ list.name }}</span>
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else-if="status !== 'pending'" class="text-sm text-muted">
        Még nincs ilyen lista.
      </p>

      <UForm
        :schema="nameSchema"
        :state="forms[section.type]"
        class="flex items-start gap-2"
        @submit="createList(section.type, $event)"
      >
        <UFormField name="name" class="flex-1">
          <UInput
            v-model="forms[section.type].name"
            :placeholder="section.placeholder"
            aria-label="Új lista neve"
            class="w-full"
          />
        </UFormField>
        <UButton type="submit" icon="i-lucide-plus" label="Új lista" />
      </UForm>
    </section>
  </div>
</template>
