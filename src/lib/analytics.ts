import type {
  Animal,
  AnimalAchievement,
  AnimalInoculation,
  AnimalWeight,
  BreedingEvent,
} from './types'
import { animalLabel, formatAnimalSex, formatAnimalStatus, formatSalePrice, formatSpecies } from './animals'
import { animalPlaceLabel } from './locations'
import { formatBreedingOutcome } from './breeding'
import { buildInoculationAlerts } from './herdInsights'
import { healthKindLabel, inoculationDisplayName, todayDateValue } from './inoculations'

export type AnalyticsPeriod = 'all' | number

export interface AnalyticsInput {
  animals: Animal[]
  breedingEvents: BreedingEvent[]
  inoculations: AnimalInoculation[]
  weights: AnimalWeight[]
  achievements: AnimalAchievement[]
}

export interface CountRow {
  label: string
  count: number
}

export interface DamRow {
  animalId: string
  label: string
  count: number
}

export interface AnalyticsReport {
  periodLabel: string
  active: number
  females: number
  males: number
  parentsLinked: number
  births: number
  birthSexes: CountRow[]
  pregnant: number
  sold: number
  saleTotalLabel: string
  saleAverageLabel: string
  pricedSales: number
  species: CountRow[]
  breeds: CountRow[]
  sexes: CountRow[]
  ages: CountRow[]
  statuses: CountRow[]
  selections: CountRow[]
  schedules: CountRow[]
  places: CountRow[]
  services: number
  breedingOutcomes: CountRow[]
  breedingSuccessLabel: string
  averageLitterLabel: string
  birthsByPeriod: CountRow[]
  birthsByPeriodMode: 'month' | 'year'
  topDams: DamRow[]
  salesByPeriod: CountRow[]
  salesByPeriodMode: 'month' | 'year'
  buyers: CountRow[]
  vaccinations: number
  treatments: number
  overdueHealth: number
  healthNames: CountRow[]
  weighedAnimals: number
  weighIns: number
  averageWeightLabel: string
  femaleWeightLabel: string
  maleWeightLabel: string
  shows: number
  showResults: CountRow[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const AGE_ORDER = [
  'Under 6 months',
  '6–12 months',
  '1–2 years',
  '2–5 years',
  '5 years and older',
  'No birth date',
]

const STATUS_ORDER = ['Active', 'Sold', 'Deceased', 'Transferred', 'Stamboek']
const SEX_ORDER = ['Female', 'Male', 'Unknown']
const OUTCOME_ORDER = ['Open / mated', 'Pregnant', 'Born', 'Failed / open']

function isActive(animal: Animal) {
  return !animal.status || animal.status === 'active'
}

function dated(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value))
}

function inPeriod(value: string | null | undefined, period: AnalyticsPeriod) {
  if (!dated(value) || !value) return false
  if (period === 'all') return true
  return value.startsWith(`${period}-`)
}

function yearOf(value: string) {
  return Number(value.slice(0, 4))
}

function monthIndex(value: string) {
  return Number(value.slice(5, 7)) - 1
}

function saleAmount(animal: Animal) {
  if (animal.sale_price == null || animal.sale_price === '') return null
  const amount = typeof animal.sale_price === 'number' ? animal.sale_price : Number(animal.sale_price)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount
}

function buyerLabel(animal: Animal) {
  const name = [animal.buyer_name, animal.buyer_surname].filter(Boolean).join(' ').trim()
  return name || 'Buyer not recorded'
}

function ageBand(birthDate: string | null, today: string) {
  if (!dated(birthDate) || !birthDate) return 'No birth date'
  const birth = new Date(`${birthDate}T00:00:00`)
  const now = new Date(`${today}T00:00:00`)
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) return 'No birth date'
  if (months < 6) return 'Under 6 months'
  if (months < 12) return '6–12 months'
  if (months < 24) return '1–2 years'
  if (months < 60) return '2–5 years'
  return '5 years and older'
}

function bump(map: Map<string, number>, label: string) {
  map.set(label, (map.get(label) ?? 0) + 1)
}

function orderedCounts(map: Map<string, number>, order: string[]) {
  const rows = order
    .filter((label) => (map.get(label) ?? 0) > 0)
    .map((label) => ({ label, count: map.get(label) ?? 0 }))
  const known = new Set(order)
  const extra = [...map.entries()]
    .filter(([label, count]) => count > 0 && !known.has(label))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }))
  return [...rows, ...extra]
}

function topCounts(map: Map<string, number>, limit: number) {
  const sorted = [...map.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (sorted.length <= limit) return sorted.map(([label, count]) => ({ label, count }))
  const head = sorted.slice(0, limit).map(([label, count]) => ({ label, count }))
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0)
  if (rest > 0) head.push({ label: 'Other', count: rest })
  return head
}

function monthRows(values: string[], year: number) {
  const counts = Array.from({ length: 12 }, () => 0)
  for (const value of values) {
    const index = monthIndex(value)
    if (index >= 0 && index < 12) counts[index] += 1
  }
  const now = new Date()
  let last = year === now.getFullYear() ? now.getMonth() : 11
  counts.forEach((count, index) => {
    if (count > 0) last = Math.max(last, index)
  })
  return MONTHS.slice(0, last + 1).map((label, index) => ({ label, count: counts[index] ?? 0 }))
}

function yearRows(values: string[]) {
  const map = new Map<string, number>()
  for (const value of values) bump(map, String(yearOf(value)))
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }))
}

function offspringCount(event: BreedingEvent) {
  if (event.offspring_ids?.length) return event.offspring_ids.length
  if (event.calf_id) return 1
  return 0
}

function breedingWhen(event: BreedingEvent) {
  if (event.outcome === 'calved') return event.expected_calving_at || event.served_at
  return event.served_at
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function weightLabel(value: number | null) {
  if (value == null) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })} kg`
}

export function analyticsYears(input: AnalyticsInput) {
  const years = new Set<number>([new Date().getFullYear()])
  const dates = [
    ...input.animals.flatMap((animal) => [animal.birth_date, animal.sold_on]),
    ...input.breedingEvents.map((event) => breedingWhen(event)),
    ...input.inoculations.map((record) => record.administered_at),
    ...input.weights.map((record) => record.weighed_at),
    ...input.achievements.map((record) => record.shown_at),
  ]
  for (const value of dates) {
    if (dated(value) && value) years.add(yearOf(value))
  }
  return [...years].filter((year) => Number.isFinite(year)).sort((a, b) => b - a)
}

export function buildAnalytics(input: AnalyticsInput, period: AnalyticsPeriod): AnalyticsReport {
  const today = todayDateValue()
  const activeAnimals = input.animals.filter(isActive)
  const periodLabel = period === 'all' ? 'All time' : String(period)

  const sexes = new Map<string, number>()
  const species = new Map<string, number>()
  const breeds = new Map<string, number>()
  const ages = new Map<string, number>()
  const statuses = new Map<string, number>()
  const selections = new Map<string, number>()
  const schedules = new Map<string, number>()
  const places = new Map<string, number>()

  for (const animal of input.animals) {
    bump(statuses, formatAnimalStatus(animal.status ?? 'active'))
  }

  let females = 0
  let males = 0
  let parentsLinked = 0
  for (const animal of activeAnimals) {
    if (animal.sex === 'female') females += 1
    if (animal.sex === 'male') males += 1
    if (animal.dam_id || animal.sire_id) parentsLinked += 1
    bump(sexes, animal.sex === 'female' || animal.sex === 'male' ? formatAnimalSex(animal.sex) : 'Unknown')
    bump(species, animal.species ? formatSpecies(animal.species) : 'No species')
    bump(breeds, animal.breed?.trim() || 'No breed')
    bump(ages, ageBand(animal.birth_date, today))
    if (animal.selection) bump(selections, animal.selection)
    if (animal.studbook_schedule) bump(schedules, animal.studbook_schedule)
    const place = animalPlaceLabel({
      encampment: animal.encampments,
      location: animal.encampments?.locations,
      legacyLocation: animal.location,
    })
    bump(places, place === '—' ? 'No camp' : place)
  }

  const born = input.animals.filter((animal) => inPeriod(animal.birth_date, period))
  const birthSexes = new Map<string, number>()
  const dams = new Map<string, number>()
  for (const animal of born) {
    bump(birthSexes, animal.sex === 'female' || animal.sex === 'male' ? formatAnimalSex(animal.sex) : 'Unknown')
    if (animal.dam_id) bump(dams, animal.dam_id)
  }
  const animalById = new Map(input.animals.map((animal) => [animal.id, animal]))
  const topDams = [...dams.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([animalId, count]) => ({
      animalId,
      label: animalLabel(animalById.get(animalId)),
      count,
    }))

  const birthDates = born.flatMap((animal) => (animal.birth_date ? [animal.birth_date] : []))

  const soldAnimals = input.animals.filter(
    (animal) => animal.status === 'sold' && (period === 'all' ? true : inPeriod(animal.sold_on, period)),
  )
  const prices = soldAnimals.map(saleAmount).filter((amount): amount is number => amount != null)
  const saleTotal = prices.reduce((sum, amount) => sum + amount, 0)
  const saleAverage = prices.length > 0 ? saleTotal / prices.length : null
  const buyers = new Map<string, number>()
  for (const animal of soldAnimals) bump(buyers, buyerLabel(animal))
  const soldDates = soldAnimals.flatMap((animal) => (dated(animal.sold_on) && animal.sold_on ? [animal.sold_on] : []))

  const pregnantDams = new Set(
    input.breedingEvents.filter((event) => event.outcome === 'pregnant').map((event) => event.dam_id),
  )
  const periodEvents = input.breedingEvents.filter((event) => inPeriod(breedingWhen(event), period))
  const outcomes = new Map<string, number>()
  for (const event of periodEvents) {
    bump(outcomes, formatBreedingOutcome(event.outcome))
  }
  const resolved = periodEvents.filter((event) => event.outcome !== 'open')
  const successful = resolved.filter((event) => event.outcome === 'pregnant' || event.outcome === 'calved')
  const litters = periodEvents
    .filter((event) => event.outcome === 'calved')
    .map(offspringCount)
    .filter((count) => count > 0)
  const litterAverage = average(litters)

  const periodHealth = input.inoculations.filter((record) => inPeriod(record.administered_at, period))
  const healthNames = new Map<string, number>()
  let vaccinations = 0
  let treatments = 0
  for (const record of periodHealth) {
    if (record.kind === 'treatment') treatments += 1
    else vaccinations += 1
    bump(healthNames, `${healthKindLabel(record.kind)} · ${inoculationDisplayName(record)}`)
  }

  const latestWeight = new Map<string, AnimalWeight>()
  const sortedWeights = [...input.weights].sort((a, b) => b.weighed_at.localeCompare(a.weighed_at))
  for (const record of sortedWeights) {
    if (!latestWeight.has(record.animal_id)) latestWeight.set(record.animal_id, record)
  }
  const activeWeights = activeAnimals
    .map((animal) => latestWeight.get(animal.id))
    .filter((record): record is AnimalWeight => Boolean(record))
  const femaleWeights = activeWeights
    .filter((record) => animalById.get(record.animal_id)?.sex === 'female')
    .map((record) => record.weight_kg)
  const maleWeights = activeWeights
    .filter((record) => animalById.get(record.animal_id)?.sex === 'male')
    .map((record) => record.weight_kg)

  const periodShows = input.achievements.filter((record) => inPeriod(record.shown_at, period))
  const showResults = new Map<string, number>()
  for (const record of periodShows) bump(showResults, record.result?.trim() || 'No result')

  const byMonth = period !== 'all'

  return {
    periodLabel,
    active: activeAnimals.length,
    females,
    males,
    parentsLinked,
    births: born.length,
    birthSexes: orderedCounts(birthSexes, SEX_ORDER),
    pregnant: pregnantDams.size,
    sold: soldAnimals.length,
    saleTotalLabel: prices.length > 0 ? (formatSalePrice(saleTotal) ?? '—') : '—',
    saleAverageLabel: saleAverage != null ? (formatSalePrice(saleAverage) ?? '—') : '—',
    pricedSales: prices.length,
    species: topCounts(species, 6),
    breeds: topCounts(breeds, 8),
    sexes: orderedCounts(sexes, SEX_ORDER),
    ages: orderedCounts(ages, AGE_ORDER),
    statuses: orderedCounts(statuses, STATUS_ORDER),
    selections: topCounts(selections, 8),
    schedules: topCounts(schedules, 8),
    places: topCounts(places, 10),
    services: periodEvents.length,
    breedingOutcomes: orderedCounts(outcomes, OUTCOME_ORDER),
    breedingSuccessLabel:
      resolved.length > 0 ? `${Math.round((successful.length / resolved.length) * 100)}%` : '—',
    averageLitterLabel: litterAverage != null ? litterAverage.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—',
    birthsByPeriod: byMonth ? monthRows(birthDates, period) : yearRows(birthDates),
    birthsByPeriodMode: byMonth ? 'month' : 'year',
    topDams,
    salesByPeriod: byMonth ? monthRows(soldDates, period) : yearRows(soldDates),
    salesByPeriodMode: byMonth ? 'month' : 'year',
    buyers: topCounts(buyers, 6),
    vaccinations,
    treatments,
    overdueHealth: buildInoculationAlerts(input.inoculations, input.animals).overdue.length,
    healthNames: topCounts(healthNames, 8),
    weighedAnimals: activeWeights.length,
    weighIns: input.weights.filter((record) => inPeriod(record.weighed_at, period)).length,
    averageWeightLabel: weightLabel(average(activeWeights.map((record) => record.weight_kg))),
    femaleWeightLabel: weightLabel(average(femaleWeights)),
    maleWeightLabel: weightLabel(average(maleWeights)),
    shows: periodShows.length,
    showResults: topCounts(showResults, 6),
  }
}
