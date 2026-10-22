import type { InjectionKey } from 'vue'

// Provided by pages/[type].vue so the open list can update the tile counts after a change
export const REFRESH_LISTS: InjectionKey<() => Promise<void>> = Symbol('refreshLists')
