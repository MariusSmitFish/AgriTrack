export function normalizeSearch(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** All space-separated tokens must appear somewhere in the joined fields. */
export function matchesSearch(
  query: string,
  fields: Array<string | number | null | undefined>,
) {
  const normalized = normalizeSearch(query)
  if (!normalized) return true

  const haystack = fields
    .filter((field) => field !== null && field !== undefined && field !== '')
    .map((field) => String(field).toLowerCase())
    .join(' ')

  return normalized.split(' ').every((token) => haystack.includes(token))
}

export function filterBySearch<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | number | null | undefined>,
) {
  const normalized = normalizeSearch(query)
  if (!normalized) return items
  return items.filter((item) => matchesSearch(normalized, getFields(item)))
}
