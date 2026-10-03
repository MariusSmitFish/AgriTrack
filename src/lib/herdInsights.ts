import type { Animal, AnimalInoculation } from './types'
import { animalLabel } from './animals'
import { animalPlaceLabel } from './locations'
import { todayDateValue } from './inoculations'

export function addDaysToDateValue(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export interface HerdStats {
  total: number
  active: number
  males: number
  females: number
  withParentsLinked: number
  unassignedCamp: number
}

export function computeHerdStats(animals: Animal[]): HerdStats {
  const activeAnimals = animals.filter((a) => !a.status || a.status === 'active')

  return {
    total: animals.length,
    active: activeAnimals.length,
    males: activeAnimals.filter((a) => a.sex === 'male').length,
    females: activeAnimals.filter((a) => a.sex === 'female').length,
    withParentsLinked: activeAnimals.filter((a) => a.dam_id || a.sire_id).length,
    unassignedCamp: activeAnimals.filter((a) => !a.encampment_id).length,
  }
}

export interface CampHeadcount {
  key: string
  label: string
  count: number
}

export function computeCampHeadcounts(animals: Animal[], limit = 8): CampHeadcount[] {
  const active = animals.filter((a) => !a.status || a.status === 'active')
  const counts = new Map<string, CampHeadcount>()

  for (const animal of active) {
    const label = animalPlaceLabel({
      encampment: animal.encampments,
      location: animal.encampments?.locations,
      legacyLocation: animal.location,
    })
    const key = animal.encampment_id ?? label
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { key, label, count: 1 })
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit)
}

export interface InoculationAlert {
  id: string
  animalId: string
  animalLabel: string
  name: string
  nextDueAt: string
  overdue: boolean
}

export function buildInoculationAlerts(
  inoculations: AnimalInoculation[],
  animals: Animal[],
  upcomingDays = 30,
): { overdue: InoculationAlert[]; upcoming: InoculationAlert[] } {
  const today = todayDateValue()
  const horizon = addDaysToDateValue(today, upcomingDays)
  const animalMap = new Map(animals.map((a) => [a.id, a]))

  const overdue: InoculationAlert[] = []
  const upcoming: InoculationAlert[] = []

  for (const record of inoculations) {
    if (!record.next_due_at) continue
    const animal = animalMap.get(record.animal_id)
    const alert: InoculationAlert = {
      id: record.id,
      animalId: record.animal_id,
      animalLabel: animal ? animalLabel(animal) : 'Unknown animal',
      name: record.name,
      nextDueAt: record.next_due_at,
      overdue: record.next_due_at < today,
    }

    if (alert.overdue) overdue.push(alert)
    else if (record.next_due_at <= horizon) upcoming.push(alert)
  }

  overdue.sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt))
  upcoming.sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt))

  return { overdue, upcoming }
}
