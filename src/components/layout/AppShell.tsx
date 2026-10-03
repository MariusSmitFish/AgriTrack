import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'

export interface NavItem {
  to: string
  label: string
  end?: boolean
}

interface AppShellProps {
  title: string
  navItems: NavItem[]
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-xl px-3 py-3 text-base font-semibold transition touch-manipulation lg:py-2.5 lg:text-sm ${
    isActive
      ? 'bg-pasture-700 text-white shadow-sm'
      : 'text-soil-700 hover:bg-pasture-50 hover:text-pasture-900'
  }`

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  )
}

export function AppShell({ title, navItems }: AppShellProps) {
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    if (!menuOpen) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="field-pattern min-h-screen">
      <header className="print-hide sticky top-0 z-30 border-b border-pasture-800/15 bg-panel/95 shadow-sm shadow-pasture-900/10 backdrop-blur supports-[backdrop-filter]:bg-panel/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-field-dark bg-panel-muted text-soil-700 hover:bg-pasture-50 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <MenuIcon open={menuOpen} />
            </button>
            <div className="min-w-0">
              <Logo size="sm" />
              <h1 className="mt-0.5 truncate text-sm font-semibold text-pasture-800 sm:text-base">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[140px] truncate text-sm text-soil-500 sm:block md:max-w-xs lg:max-w-md">
              {profile?.email}
            </span>
            <Button
              variant="secondary"
              className="px-3 py-2 text-xs sm:text-sm"
              onClick={() => signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="print-hide fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-soil-800/50"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <nav className="absolute inset-x-0 top-0 max-h-[min(100dvh,40rem)] overflow-y-auto rounded-b-3xl border-b border-field-dark bg-panel px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-xl shadow-pasture-900/20">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-soil-500">
                Menu
              </p>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-field-dark bg-panel-muted text-soil-700"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                <MenuIcon open />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                  onClick={closeMenu}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <p className="mt-4 truncate border-t border-field-dark pt-3 text-sm text-soil-500">
              {profile?.email}
            </p>
          </nav>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
        <div className="flex gap-6 lg:gap-8">
          <aside className="print-hide hidden w-52 shrink-0 lg:block xl:w-56">
            <nav className="sticky top-24 flex flex-col gap-1 rounded-2xl border border-field-dark bg-panel p-2 shadow-md shadow-pasture-900/10">
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-soil-500">
                Menu
              </p>
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="h-1.5 w-14 rounded-full bg-pasture-600" aria-hidden="true" />
      <h2 className="mt-3 font-display text-xl font-bold text-pasture-900 sm:text-2xl">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-sm text-soil-600">{description}</p>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border border-dashed border-field-dark bg-panel-muted px-4 py-6 text-center text-sm text-soil-600">
      {children}
    </p>
  )
}

export function MobileCardList({ children }: { children: ReactNode }) {
  return <div className="mt-4 space-y-3 md:hidden">{children}</div>
}

export function MobileCard({
  title,
  subtitle,
  fields,
  action,
}: {
  title: string
  subtitle?: string
  fields: { label: string; value: string }[]
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-field-dark bg-panel-muted p-4 shadow-sm shadow-pasture-900/5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-pasture-900">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-sm text-soil-600">{subtitle}</p>}
        </div>
        {action && (
          <div className="flex shrink-0 flex-col items-end gap-1 [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center [&_button]:inline-flex [&_button]:min-h-10 [&_button]:items-center [&_button]:touch-manipulation">
            {action}
          </div>
        )}
      </div>
      <dl className="mt-3 space-y-2.5 border-t border-field-dark/80 pt-3">
        {fields.map((field) => (
          <div key={field.label} className="flex justify-between gap-4 text-sm">
            <dt className="text-soil-500">{field.label}</dt>
            <dd className="truncate text-right font-medium text-soil-800">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function DesktopTable({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 hidden overflow-hidden rounded-xl border border-field-dark md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm [&_tbody_tr:nth-child(even)]:bg-panel-muted/80 [&_tbody_tr:hover]:bg-pasture-50 [&_thead]:bg-pasture-800 [&_thead_th]:px-3 [&_thead_th]:py-3 [&_thead_th]:font-semibold [&_thead_th]:text-pasture-50 [&_tbody_td]:px-3">
          {children}
        </table>
      </div>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-field-dark text-soil-500">{children}</tr>
    </thead>
  )
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-field-dark/60">{children}</tr>
}
