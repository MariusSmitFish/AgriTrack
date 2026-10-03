import type { ButtonHTMLAttributes, ReactNode } from 'react'

const variants = {
  primary: 'bg-pasture-800 text-white hover:bg-pasture-700 shadow-sm',
  secondary: 'bg-panel-muted text-soil-800 border border-field-dark hover:bg-pasture-50',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
