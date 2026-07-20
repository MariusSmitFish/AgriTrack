/** Extract the most likely ear-tag number from OCR text. */
export function extractTagFromOcr(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  // Prefer sequences of digits (common for ear tags), optionally with letter prefix
  const candidates = cleaned.match(/[A-Za-z]?[0-9]{2,}[A-Za-z0-9-]*/g) ?? []
  if (candidates.length === 0) {
    return cleaned.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20)
  }

  return candidates.sort((a, b) => b.length - a.length)[0]?.toUpperCase() ?? ''
}

export function formatAnimalSex(sex: string | null) {
  if (!sex) return '—'
  if (sex === 'male') return 'Male'
  if (sex === 'female') return 'Female'
  return 'Unknown'
}

export function formatAnimalStatus(status: string | null) {
  if (!status) return '—'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export const animalSexOptions = [
  { value: '', label: 'Not specified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unknown', label: 'Unknown' },
] as const

export const animalStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'transferred', label: 'Transferred' },
] as const

export const animalSpeciesOptions = [
  { value: 'cattle', label: 'Cattle' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'goat', label: 'Goat' },
  { value: 'other', label: 'Other' },
] as const
