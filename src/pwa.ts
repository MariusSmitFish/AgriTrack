import { registerSW } from 'virtual:pwa-register'

/** Check for a new build when the app is opened again, and reload into it. */
export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true)
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return

      const checkForUpdate = () => {
        void registration.update()
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setInterval(checkForUpdate, 60 * 60 * 1000)
    },
  })
}
