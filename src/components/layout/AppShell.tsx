import { useState, type ReactNode } from 'react'
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
  `block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-pasture-100 text-pasture-900'
      : 'text-soil-600 hover:bg-field hover:text-soil-800'
  }`

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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

  return (
    <div className="field-pattern min-h-screen">
      <header className="sticky top-0 z-30 border-b border-field-dark/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex rounded-xl border border-field-dark p-2 text-soil-600 hover:bg-field lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <MenuIcon open={menuOpen} />
            </button>
            <div className="min-w-0">
              <Logo size="sm" />
              <h1 className="mt-0.5 truncate text-sm font-semibold text-soil-600 sm:text-base">{title}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[140px] truncate text-sm text-soil-500 sm:block md:max-w-xs lg:max-w-md">
              {profile?.email}
            </span>
            <Button variant="secondary" className="px-3 py-2 text-xs sm:text-sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-field-dark/80 px-4 py-3 lg:hidden">
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
            <p className="mt-3 truncate text-xs text-soil-500 sm:hidden">{profile?.email}</p>
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
        <div className="flex gap-6 lg:gap-8">
          <aside className="hidden w-52 shrink-0 lg:block xl:w-56">
            <nav className="sticky top-24 flex flex-col gap-1 rounded-2xl border border-field-dark/80 bg-white/70 p-2">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5 sm:mb-6">
      <h2 className="font-display text-xl font-bold text-pasture-900 sm:text-2xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-soil-500">{description}</p>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm text-soil-500">{children}</p>
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
    <div className="rounded-2xl border border-field-dark/80 bg-field/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-soil-800">{title}</p>
          {subtitle && <p className="truncate text-sm text-soil-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <dl className="mt-3 space-y-2">
        {fields.map((field) => (
          <div key={field.label} className="flex justify-between gap-4 text-sm">
            <dt className="text-soil-500">{field.label}</dt>
            <dd className="truncate text-right font-medium text-soil-700">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function DesktopTable({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
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
