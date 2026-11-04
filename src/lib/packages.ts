import { supabase } from './supabase'
import type { Package, PackageLimitKey } from './types'

export type PackageUsageKey =
  | 'users'
  | 'animals'
  | 'locations'
  | 'encampments'
  | 'photos'
  | 'documents'
  | 'backups'

export const PACKAGE_LIMITS: {
  limit: PackageLimitKey
  usage: PackageUsageKey
  label: string
  hint: string
}[] = [
  {
    limit: 'max_users',
    usage: 'users',
    label: 'Team members',
    hint: 'People who can sign in to this farm.',
  },
  {
    limit: 'max_animals',
    usage: 'animals',
    label: 'Animals',
    hint: 'Every animal record, including sold, deceased, and stamboek.',
  },
  {
    limit: 'max_locations',
    usage: 'locations',
    label: 'Locations',
    hint: 'Places on the farm.',
  },
  {
    limit: 'max_encampments',
    usage: 'encampments',
    label: 'Camps',
    hint: 'Camps inside those locations.',
  },
  {
    limit: 'max_photos',
    usage: 'photos',
    label: 'Photos',
    hint: 'Photos stored on animal records.',
  },
  {
    limit: 'max_documents',
    usage: 'documents',
    label: 'Documents',
    hint: 'Files stored on animal records.',
  },
  {
    limit: 'max_backups',
    usage: 'backups',
    label: 'Backups',
    hint: 'Saved herd backups. Delete an old one to free a slot.',
  },
]

export interface CompanyPlanPackage {
  id: string | null
  slug: string | null
  name: string | null
  description: string | null
  yearly_price: number | string | null
  currency: string | null
  max_users: number | null
  max_animals: number | null
  max_locations: number | null
  max_encampments: number | null
  max_photos: number | null
  max_documents: number | null
  max_backups: number | null
}

export interface CompanyPlan {
  company_id: string
  package: CompanyPlanPackage | null
  usage: Record<PackageUsageKey, number>
}

export function formatPackagePrice(price: number | string | null | undefined, currency: string | null | undefined) {
  const amount = typeof price === 'string' ? Number(price) : price
  if (amount == null || Number.isNaN(amount) || amount <= 0) return 'No yearly price set'
  try {
    return `${new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount)} / year`
  } catch {
    return `${amount} ${currency || ''} / year`.trim()
  }
}

export function formatLimit(value: number | null | undefined) {
  return value == null ? 'Unlimited' : String(value)
}

export function limitReached(used: number, max: number | null | undefined) {
  return max != null && used >= max
}

export async function fetchPackages() {
  const { data, error } = await supabase.from('packages').select('*').order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as Package[]
}

export async function fetchCompanyPlan() {
  const { data, error } = await supabase.rpc('company_plan_usage')
  if (error) throw new Error(error.message)
  if (!data) return null

  const plan = data as CompanyPlan
  const usage = Object.fromEntries(
    (Object.keys(plan.usage ?? {}) as PackageUsageKey[]).map((key) => [key, Number(plan.usage[key]) || 0]),
  ) as CompanyPlan['usage']

  return { ...plan, usage }
}

export function parseOptionalLimit(value: string, label: string) {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a whole number, or blank for unlimited.`)
  }
  return Number(trimmed)
}
