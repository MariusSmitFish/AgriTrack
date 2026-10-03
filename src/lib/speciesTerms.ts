export type SpeciesKey = 'cattle' | 'sheep' | 'goat' | 'other'

export function normalizeSpecies(species: string | null | undefined): SpeciesKey {
  const value = (species ?? '').trim().toLowerCase()
  if (value === 'sheep') return 'sheep'
  if (value === 'goat') return 'goat'
  if (value === 'cattle' || value === 'cow' || value === 'bovine') return 'cattle'
  if (!value) return 'other'
  return 'other'
}

/** Typical gestation used when expected birth date is left blank. */
export function gestationDaysForSpecies(species: string | null | undefined) {
  switch (normalizeSpecies(species)) {
    case 'sheep':
      return 147
    case 'goat':
      return 150
    case 'cattle':
      return 283
    default:
      return 280
  }
}

/** Noun for the birth event: calving / lambing / kidding / birthing */
export function birthEventNoun(species: string | null | undefined) {
  switch (normalizeSpecies(species)) {
    case 'cattle':
      return 'calving'
    case 'sheep':
      return 'lambing'
    case 'goat':
      return 'kidding'
    default:
      return 'birthing'
  }
}

export function birthEventNounTitle(species: string | null | undefined) {
  const noun = birthEventNoun(species)
  return noun.charAt(0).toUpperCase() + noun.slice(1)
}

/** Young animal: calf / lamb / kid / offspring */
export function offspringNoun(species: string | null | undefined, plural = false) {
  switch (normalizeSpecies(species)) {
    case 'cattle':
      return plural ? 'calves' : 'calf'
    case 'sheep':
      return plural ? 'lambs' : 'lamb'
    case 'goat':
      return plural ? 'kids' : 'kid'
    default:
      return plural ? 'offspring' : 'offspring'
  }
}

/** Outcome label for successful birth */
export function bornOutcomeLabel(species: string | null | undefined) {
  switch (normalizeSpecies(species)) {
    case 'cattle':
      return 'Calved'
    case 'sheep':
      return 'Lambed'
    case 'goat':
      return 'Kidded'
    default:
      return 'Born'
  }
}

/** Form/table label for expected birth date */
export function expectedBirthLabel(species: string | null | undefined) {
  const noun = birthEventNoun(species)
  return `Expected ${noun}`
}

/** Neutral labels when the farm may mix species */
export const mixedSpeciesBirthLabels = {
  outlookTitle: 'Birthing outlook',
  outlookDescription: 'Expected births overdue or within 60 days.',
  emptyUpcoming: 'No expected births in the next 60 days.',
  expectedShort: 'Expected birth',
  trackDescription: 'Log services and track expected birth dates across the herd.',
  calendarOffspring: 'offspring',
} as const
