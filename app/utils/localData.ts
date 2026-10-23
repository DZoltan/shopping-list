// Forgets fetched data and cached pages/API responses, so the next person on this device sees nothing of ours
export async function clearLocalData() {
  clearNuxtData()
  if (import.meta.client && 'caches' in window) await caches.delete('pages-and-api')
}
