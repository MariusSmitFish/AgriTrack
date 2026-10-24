import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  description?: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mb-3 flex w-full items-center justify-between rounded-xl border border-pasture-200 bg-pasture-50 px-4 py-3 text-left transition hover:border-pasture-300 hover:bg-pasture-100"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-pasture-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-sm text-soil-500">{description}</p>
          )}
        </div>
        <div className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pasture-200 text-pasture-700">
          <svg
            className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
      {isOpen && children}
    </div>
  )
}

interface CollapsibleCardProps {
  title: string
  description?: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleCard({
  title,
  description,
  children,
  defaultOpen = false,
  className = '',
}: CollapsibleCardProps) {
  return (
    <CollapsibleSection
      title={title}
      description={description}
      defaultOpen={defaultOpen}
      className={className}
    >
      {children}
    </CollapsibleSection>
  )
}
