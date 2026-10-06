import { supabase } from './supabase'
import { padDigits } from './animals'

export async function fetchCompanyStudNumber(companyId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('stud_number')
    .eq('id', companyId)
    .single()

  if (error) throw error
  return padDigits((data?.stud_number as string | null) ?? '', 4)
}

export async function updateCompanyStudNumber(companyId: string, studNumber: string) {
  const trimmed = studNumber.trim()
  const value = trimmed === '' ? null : padDigits(trimmed, 4)
  if (value && !/^\d{4}$/.test(value)) {
    throw new Error('Stud number must be 4 digits.')
  }

  const { error } = await supabase
    .from('companies')
    .update({ stud_number: value })
    .eq('id', companyId)

  if (error) throw error
  return value ?? ''
}
