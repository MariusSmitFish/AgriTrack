import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 20

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, totalItems)

  return {
    pageItems: items.slice(start, end),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    start: totalItems === 0 ? 0 : start + 1,
    end,
  }
}

export function useClientPagination<T>(
  items: T[],
  options?: {
    pageSize?: number
    /** Change this (e.g. search query) to jump back to page 1 */
    resetKey?: string | number
  },
) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [options?.resetKey, pageSize])

  const result = useMemo(
    () => paginateItems(items, page, pageSize),
    [items, page, pageSize],
  )

  useEffect(() => {
    if (page !== result.page) setPage(result.page)
  }, [page, result.page])

  return {
    ...result,
    setPage,
    hasPagination: result.totalItems > pageSize,
  }
}
