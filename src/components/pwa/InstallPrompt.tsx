import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'

const DISMISS_KEY = 'agriscalefarm-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  )
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua)
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosTip, setIosTip] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    if (isIos() && isSafari()) {
      setIosTip(true)
      setVisible(true)
      return
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', () => {
      setVisible(false)
      setDeferred(null)
      localStorage.setItem(DISMISS_KEY, '1')
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      setVisible(false)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="print-hide fixed inset-x-0 bottom-0 z-40 px-3 pt-2 sm:p-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg flex-col gap-2 rounded-2xl border border-field-dark bg-panel p-3 shadow-lg shadow-pasture-900/20 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-pasture-900">
            Install AgriScale Farm
          </p>
          {iosTip ? (
            <p className="mt-0.5 text-xs leading-snug text-soil-600 sm:mt-1 sm:text-sm">
              On iPhone: tap <span className="font-semibold">Share</span>, then{' '}
              <span className="font-semibold">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-snug text-soil-600 sm:mt-1 sm:text-sm">
              Add to your home screen for faster access in the field.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-10 flex-1 px-3 py-2 text-xs sm:flex-none"
            onClick={dismiss}
          >
            Not now
          </Button>
          {!iosTip && (
            <Button
              type="button"
              className="min-h-10 flex-1 px-3 py-2 text-xs sm:flex-none"
              disabled={!deferred || installing}
              onClick={install}
            >
              {installing ? 'Installing...' : 'Install'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
