import type { InputHTMLAttributes } from 'react'

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  label?: string
  resultCount?: number
  totalCount?: number
}

export function SearchField({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Search…',
  resultCount,
  totalCount,
  id,
  className = '',
  ...props
}: SearchFieldProps) {
  const inputId = id ?? 'search'

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="block text-sm font-semibold text-soil-700">
          {label}
        </label>
        {typeof resultCount === 'number' && typeof totalCount === 'number' && totalCount > 0 && (
          <p className="text-xs text-soil-500">
            {value.trim()
              ? `${resultCount} of ${totalCount}`
              : `${totalCount} total`}
          </p>
        )}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-soil-500" aria-hidden="true">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="m14.5 14.5-3.2-3.2m1.2-3.3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
            />
          </svg>
        </span>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-field-dark bg-panel py-2.5 pl-9 pr-10 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-soil-500 hover:bg-field hover:text-soil-800"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
