import { supabase } from './supabase'

export interface FarmDemoSeedResult {
  company_id: string
  locations: number
  encampments: number
  animals: number
  inoculations: number
}

export interface FarmResetResult {
  company_id: string
  deleted_animals: number
  deleted_inoculations: number
  deleted_photos?: number
  deleted_encampments: number
  deleted_locations: number
}

export async function seedFarmDemoData(companyId: string) {
  const { data, error } = await supabase.rpc('seed_farm_demo_data', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data as FarmDemoSeedResult
}

export async function clearFarmDemoData(companyId: string) {
  const { data, error } = await supabase.rpc('clear_farm_demo_data', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data as FarmResetResult
}

export async function resetFarmData(companyId: string) {
  const { data, error } = await supabase.rpc('reset_farm_data', {
    p_company_id: companyId,
  })
  if (error) throw error
  return data as FarmResetResult
}
