<script setup lang="ts">
import type { DropdownMenuItem, FormSubmitEvent } from '@nuxt/ui'
import type { HouseholdRole } from '#shared/constants'
import { renameHouseholdSchema } from '#shared/schemas'

const props = defineProps<{ householdId: number }>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const { user } = useUserSession()
const { data: household, refresh } = await useFetch(`/api/households/${props.householdId}`)

type Member = NonNullable<typeof household.value>['members'][number]

// Server rules (last owner, last member) explained in Hungarian
const MESSAGES: Record<string, string> = {
  'The household needs at least one owner': 'A háztartásnak legalább egy gazdája kell legyen.',
  'Make someone else an owner first': 'Előbb tegyél gazdává valaki mást.',
  'The last member cannot leave the household': 'Az utolsó tag nem léphet ki a háztartásból.',
}
function failed(error: unknown, fallback: string) {
  const message = (error as { statusMessage?: string })?.statusMessage
  toast.add({ title: (message && MESSAGES[message]) || fallback, color: 'error' })
}

// --- rename ---
const renameOpen = ref(false)
const renameState = reactive({ name: '' })

function openRename() {
  renameState.name = household.value?.name ?? ''
  renameOpen.value = true
}

async function rename(event: FormSubmitEvent<{ name: string }>) {
  try {
    await $fetch(`/api/households/${props.householdId}`, { method: 'PATCH', body: event.data })
    renameOpen.value = false
    await refresh()
    emit('changed')
  } catch (e) {
    failed(e, 'Nem sikerült átnevezni')
  }
}

// --- members ---
async function setRole(member: Member, role: HouseholdRole) {
  try {
    await $fetch(`/api/households/${props.householdId}/members/${member.id}`, { method: 'PATCH', body: { role } })
    await refresh()
  } catch (e) {
    failed(e, 'Nem sikerült módosítani')
  }
}

const removing = ref<Member>()
const isMe = (member: Member) => member.id === user.value?.id

async function confirmRemove() {
  const member = removing.value
  removing.value = undefined
  if (!member) return
  try {
    await $fetch(`/api/households/${props.householdId}/members/${member.id}`, { method: 'DELETE' })
    if (isMe(member)) emit('changed')
    else await refresh()
  } catch (e) {
    failed(e, isMe(member) ? 'Nem sikerült kilépni' : 'Nem sikerült eltávolítani')
  }
}

function memberMenu(member: Member): DropdownMenuItem[][] {
  return [
    [
      member.role === 'owner'
        ? { label: 'Taggá tesz', icon: 'i-lucide-user', onSelect: () => setRole(member, 'member') }
        : { label: 'Gazdává tesz', icon: 'i-lucide-crown', onSelect: () => setRole(member, 'owner') },
    ],
    [{ label: 'Eltávolítás a háztartásból', icon: 'i-lucide-user-minus', color: 'error', onSelect: () => { removing.value = member } }],
  ]
}
</script>

<template>
  <div v-if="household" class="overflow-hidden rounded-xl border border-default">
    <div class="flex items-center gap-2 border-b border-default bg-elevated/40 px-4 py-3">
      <UIcon name="i-lucide-house" class="size-5 text-primary" />
      <h3 class="min-w-0 flex-1 truncate font-semibold">{{ household.name }}</h3>
      <UButton v-if="household.canManage" icon="i-lucide-pencil" variant="ghost" color="neutral" size="sm" label="Átnevezés" @click="openRename" />
    </div>

    <ul class="divide-y divide-default">
      <li v-for="member in household.members" :key="member.id" class="flex items-center gap-3 px-4 py-2.5">
        <UAvatar :alt="member.name" size="sm" />
        <span class="min-w-0 flex-1 truncate">
          {{ member.name }}<span v-if="isMe(member)" class="text-muted"> (te)</span>
        </span>
        <UBadge
          :label="member.role === 'owner' ? 'gazda' : 'tag'"
          :color="member.role === 'owner' ? 'primary' : 'neutral'"
          variant="subtle"
          size="sm"
        />
        <UButton
          v-if="isMe(member) && household.members.length > 1"
          icon="i-lucide-log-out"
          variant="ghost"
          color="neutral"
          size="sm"
          label="Kilépés"
          @click="removing = member"
        />
        <UDropdownMenu v-else-if="!isMe(member) && household.canManage" :items="memberMenu(member)">
          <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" size="sm" :aria-label="`${member.name} műveletek`" />
        </UDropdownMenu>
      </li>
    </ul>

    <UModal v-model:open="renameOpen" title="Háztartás átnevezése">
      <template #body>
        <UForm :schema="renameHouseholdSchema" :state="renameState" class="space-y-4" @submit="rename">
          <UFormField label="Név" name="name">
            <UInput v-model="renameState.name" class="w-full" autofocus />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton label="Mégse" variant="ghost" color="neutral" @click="renameOpen = false" />
            <UButton type="submit" label="Mentés" />
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal
      :open="!!removing"
      :title="removing && isMe(removing) ? 'Kilépés a háztartásból' : 'Tag eltávolítása'"
      :description="removing && isMe(removing)
        ? `Biztosan kilépsz a(z) „${household.name}” háztartásból? Utána nem látod a listáit, csak egy új meghívóval térhetsz vissza.`
        : `Biztosan eltávolítod ${removing?.name} tagot? Nem fogja látni a háztartás listáit.`"
      @update:open="(open) => { if (!open) removing = undefined }"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Mégse" variant="ghost" color="neutral" @click="removing = undefined" />
          <UButton :label="removing && isMe(removing) ? 'Kilépés' : 'Eltávolítás'" color="error" @click="confirmRemove" />
        </div>
      </template>
    </UModal>
  </div>
</template>
