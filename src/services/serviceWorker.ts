import { registerSW } from 'virtual:pwa-register'

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null
let registered = false

export function registerOfflineWorker(onUpdateAvailable: () => void) {
  if (registered) return
  registered = true
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: onUpdateAvailable,
  })
}

export async function checkForPublishedUpdate() {
  if (!('serviceWorker' in navigator)) return
  const registration = await Promise.race<ServiceWorkerRegistration | null>([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5_000)),
  ])
  if (registration?.active) await registration.update()
}

export async function activatePublishedUpdate() {
  await updateServiceWorker?.(true)
}
