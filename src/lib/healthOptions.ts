import { supabase } from './supabase'
import type { HealthOption, HealthRecordKind } from './types'

export async function fetchHealthOptions(companyId: string, kind?: HealthRecordKind) {
  let query = supabase
    .from('health_options')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as HealthOption[]
}

export async function createHealthOption(params: {
  companyId: string
  kind: HealthRecordKind
  name: string
}) {
  const name = params.name.trim()
  const { data, error } = await supabase
    .from('health_options')
    .insert({
      company_id: params.companyId,
      kind: params.kind,
      name,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as HealthOption
}

export async function deleteHealthOption(id: string) {
  const { error } = await supabase.from('health_options').delete().eq('id', id)
  if (error) throw error
}
