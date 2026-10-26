import type {
  Animal,
  AnimalAchievement,
  AnimalInoculation,
  AnimalWeight,
  BreedingEvent,
  Encampment,
  FarmLocation,
  HealthOption,
} from './types'
import type { FarmSnapshot } from './offlineHerd'
import { supabase } from './supabase'

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

async function fetchAll<T>(
  query: () => { range: (from: number, to: number) => PromiseLike<PageResult<T>> },
) {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query().range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return rows
  }
}

export async function fetchFarmSnapshot(companyId: string): Promise<FarmSnapshot> {
  const [animals, locations, encampments, breedingEvents, inoculations, weights, achievements, healthOptions] =
    await Promise.all([
      fetchAll<Animal>(() =>
        supabase
          .from('animals')
          .select('*, encampments(id, name, location_id, locations(id, name))')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
      ),
      fetchAll<FarmLocation>(() =>
        supabase.from('locations').select('*').eq('company_id', companyId).order('name'),
      ),
      fetchAll<Encampment>(() =>
        supabase.from('encampments').select('*').eq('company_id', companyId).order('name'),
      ),
      fetchAll<BreedingEvent>(() =>
        supabase
          .from('breeding_events')
          .select('*')
          .eq('company_id', companyId)
          .order('served_at', { ascending: false }),
      ),
      fetchAll<AnimalInoculation>(() =>
        supabase
          .from('animal_inoculations')
          .select('*')
          .eq('company_id', companyId)
          .order('administered_at', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
      fetchAll<AnimalWeight>(() =>
        supabase
          .from('animal_weights')
          .select('*')
          .eq('company_id', companyId)
          .order('weighed_at', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
      fetchAll<AnimalAchievement>(() =>
        supabase
          .from('animal_achievements')
          .select('*')
          .eq('company_id', companyId)
          .order('shown_at', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
      fetchAll<HealthOption>(() =>
        supabase.from('health_options').select('*').eq('company_id', companyId).order('name'),
      ),
    ])

  return {
    savedAt: new Date().toISOString(),
    animals,
    locations,
    encampments,
    breedingEvents,
    inoculations,
    weights: weights.map((row) => ({ ...row, weight_kg: Number(row.weight_kg) })),
    achievements,
    healthOptions,
  }
}
