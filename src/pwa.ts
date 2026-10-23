import { registerSW } from 'virtual:pwa-register'

const RELOAD_KEY = 'agriscalefarm-sw-reload'

/** Check for a new build when the installed app is opened, and reload into it. */
export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  // The first install has no controller yet. Later updates replace it, and
  // the open app must reload or it keeps drawing the previous build.
  let hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return
    sessionStorage.setItem(RELOAD_KEY, '1')
    window.location.reload()
  })
  window.setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 10_000)

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

      checkForUpdate()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
      window.addEventListener('pageshow', checkForUpdate)
      window.setInterval(checkForUpdate, 5 * 60 * 1000)
    },
  })
}
