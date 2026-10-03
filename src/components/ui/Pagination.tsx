import { Button } from './Button'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  start: number
  end: number
  onPageChange: (page: number) => void
  className?: string
}

function pageNumbers(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  if (current <= 3) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
  }
  if (current >= total - 2) {
    pages.add(total - 1)
    pages.add(total - 2)
    pages.add(total - 3)
  }

  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  start,
  end,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalItems === 0 || totalPages <= 1) return null

  const pages = pageNumbers(page, totalPages)

  return (
    <div
      className={`mt-4 flex flex-col gap-3 border-t border-field-dark/80 pt-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-sm text-soil-600">
        Showing <span className="font-semibold text-soil-800">{start}</span>
        –<span className="font-semibold text-soil-800">{end}</span> of{' '}
        <span className="font-semibold text-soil-800">{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>

        {pages.map((pageNumber, index) => {
          const prev = pages[index - 1]
          const showEllipsis = prev !== undefined && pageNumber - prev > 1

          return (
            <span key={pageNumber} className="contents">
              {showEllipsis && <span className="px-1 text-sm text-soil-500">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={`min-h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${
                  pageNumber === page
                    ? 'bg-pasture-700 text-white shadow-sm'
                    : 'border border-field-dark bg-panel-muted text-soil-700 hover:bg-pasture-50'
                }`}
                aria-current={pageNumber === page ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            </span>
          )
        })}

        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
