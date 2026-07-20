import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-field-dark/80 bg-white p-4 shadow-sm shadow-pasture-900/5 sm:p-6 ${className}`}
    >
      {children}
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
  const accentClass = accent === 'barn' ? 'border-barn-500' : 'border-pasture-600'

  return (
    <Card className={`border-l-4 ${accentClass}`}>
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
      className={`block rounded-xl border border-pasture-100 bg-pasture-50 px-4 py-3 text-center text-sm font-semibold text-pasture-800 transition hover:border-pasture-200 hover:bg-pasture-100 sm:inline-block sm:py-2 ${className}`}
    >
      {children}
    </Link>
  )
}
