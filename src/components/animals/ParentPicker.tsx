import { useDeferredValue, useMemo, useState } from 'react'
import type { Animal } from '../../lib/types'
import {
  animalOptionLabel,
  animalsWithExactTag,
  exactTagQuery,
  formatAnimalId,
  formatTagNumber,
  studTagChoiceLabel,
} from '../../lib/animals'
import { filterBySearch } from '../../lib/search'
import { SearchField } from '../ui/SearchField'

interface ParentPickerProps {
  id: string
  label: string
  animals: Animal[]
  selectedId: string
  onSelect: (id: string) => void
  placeholder?: string
  enableTagScan?: boolean
}

export function ParentPicker({
  id,
  label,
  animals,
  selectedId,
  onSelect,
  placeholder = 'Search animal ID or tag…',
  enableTagScan = false,
}: ParentPickerProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const selected = animals.find((animal) => animal.id === selectedId) ?? null

  const exactTag = exactTagQuery(deferredQuery)

  const matches = useMemo(() => {
    if (!deferredQuery.trim()) return []
    const pool = animals.filter((animal) => animal.id !== selectedId)
    if (exactTag) {
      return animalsWithExactTag(pool, exactTag).sort((a, b) =>
        (a.stud_number ?? '').localeCompare(b.stud_number ?? ''),
      )
    }
    return filterBySearch(pool, deferredQuery, (animal) => [
      formatAnimalId(animal),
      formatTagNumber(animal),
      animal.stud_number,
      animal.studbook_number,
      animal.name,
    ])
  }, [animals, deferredQuery, exactTag, selectedId])

  const duplicateTag = Boolean(exactTag && matches.length > 1)
  const visible = exactTag ? matches : matches.slice(0, 8)

  return (
    <div className="space-y-2">
      <SearchField
        id={id}
        label={label}
        value={query}
        onChange={setQuery}
        placeholder={placeholder}
        resultCount={deferredQuery.trim() ? matches.length : undefined}
        totalCount={deferredQuery.trim() ? animals.length : undefined}
        enableTagScan={enableTagScan}
      />

      {selected && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-pasture-600/30 bg-pasture-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-soil-500">Selected</p>
            <p className="truncate text-sm font-medium text-soil-800">{animalOptionLabel(selected)}</p>
          </div>
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-soil-600 hover:text-soil-800"
            onClick={() => onSelect('')}
          >
            Clear
          </button>
        </div>
      )}

      {deferredQuery.trim() && matches.length === 0 && (
        <p className="text-sm text-soil-500">No animals match that search.</p>
      )}

      {visible.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-field-dark bg-panel">
          {visible.map((animal) => (
            <li key={animal.id} className="border-b border-field-dark/70 last:border-b-0">
              <button
                type="button"
                className="min-h-11 w-full px-3 py-2.5 text-left text-sm font-medium text-soil-800 hover:bg-pasture-50"
                onClick={() => {
                  onSelect(animal.id)
                  setQuery('')
                }}
              >
                {duplicateTag ? studTagChoiceLabel(animal) : animalOptionLabel(animal)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {duplicateTag && (
        <p className="text-xs text-soil-500">
          {matches.length} animals use tag {exactTag}. Each line is a different stud number.
        </p>
      )}

      {matches.length > visible.length && (
        <p className="text-xs text-soil-500">Showing 8 matches. Keep typing to narrow the list.</p>
      )}

      {!deferredQuery.trim() && !selected && (
        <p className="text-sm text-soil-500">Search by animal ID, tag, or name.</p>
      )}
    </div>
  )
}
