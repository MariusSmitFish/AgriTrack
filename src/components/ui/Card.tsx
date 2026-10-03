import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Card({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: 'default' | 'muted' | 'accent'
}) {
  const hasCustomBg = /\bbg-/.test(className)
  const noPadding = /\bp-0\b/.test(className)

  const toneClass =
    tone === 'muted'
      ? 'bg-panel-muted'
      : tone === 'accent'
        ? 'bg-pasture-50'
        : 'bg-panel'

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-field-dark shadow-md shadow-pasture-900/10 ${
        hasCustomBg ? '' : toneClass
      } ${className}`}
    >
      <div
        className={`h-1.5 ${
          tone === 'accent'
            ? 'bg-gradient-to-r from-barn-500 to-pasture-600'
            : 'bg-gradient-to-r from-pasture-700 via-pasture-600 to-pasture-200'
        }`}
        aria-hidden="true"
      />
      <div className={noPadding ? undefined : 'p-4 sm:p-6'}>{children}</div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  accent = 'pasture',
}: {
  label: string
  value: string | number
  accent?: 'pasture' | 'barn'
}) {
  const accentClass = accent === 'barn' ? 'border-l-barn-500' : 'border-l-pasture-600'

  return (
    <Card className={`border-l-4 ${accentClass}`} tone={accent === 'barn' ? 'muted' : 'default'}>
      <p className="text-sm font-medium text-soil-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-pasture-900 sm:text-3xl">{value}</p>
    </Card>
  )
}

export function ActionLink({
  to,
  children,
  className = '',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`block rounded-xl border border-pasture-200 bg-pasture-50 px-4 py-3 text-center text-sm font-semibold text-pasture-800 transition hover:border-pasture-600 hover:bg-pasture-100 sm:inline-block sm:py-2 ${className}`}
    >
      {children}
    </Link>
  )
}
