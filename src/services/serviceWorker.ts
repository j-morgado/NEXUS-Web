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
  if (!('serviceWorker' in navigator)) return 'unavailable' as const
  const registration = await Promise.race<ServiceWorkerRegistration | null>([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5_000)),
  ])
  if (!registration?.active) return 'unavailable' as const
  await registration.update()
  if (registration.installing) await new Promise<void>(resolve => {
    const worker = registration.installing!
    const timer = window.setTimeout(resolve, 15000)
    const changed = () => { if (worker.state === 'installed' || worker.state === 'redundant') { clearTimeout(timer); worker.removeEventListener('statechange', changed); resolve() } }
    worker.addEventListener('statechange', changed)
    changed()
  })
  if (registration.installing) return 'downloading' as const
  return registration.waiting ? 'available' as const : 'current' as const
}

export async function activatePublishedUpdate() {
  await updateServiceWorker?.(true)
}
