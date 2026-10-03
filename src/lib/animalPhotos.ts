import { supabase } from './supabase'
import type { AnimalPhoto, AnimalPhotoWithUrl } from './types'

const BUCKET = 'animal-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60

export function toDatetimeLocalValue(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function formatPhotoDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function extensionForFile(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName

  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic' || file.type === 'image/heif') return 'heic'
  return 'jpg'
}

export async function fetchAnimalPhotos(animalId: string): Promise<AnimalPhotoWithUrl[]> {
  const { data, error } = await supabase
    .from('animal_photos')
    .select('*')
    .eq('animal_id', animalId)
    .order('captured_at', { ascending: false })

  if (error) throw error

  const photos = (data ?? []) as AnimalPhoto[]
  if (photos.length === 0) return []

  const withUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS)

      return { ...photo, url: signed?.signedUrl ?? null }
    }),
  )

  return withUrls
}

export async function uploadAnimalPhoto(params: {
  companyId: string
  animalId: string
  userId: string
  file: File
  capturedAt?: string
  caption?: string
}) {
  const photoId = crypto.randomUUID()
  const ext = extensionForFile(params.file)
  const storagePath = `${params.companyId}/${params.animalId}/${photoId}.${ext}`
  const capturedAt = params.capturedAt ?? new Date().toISOString()

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, params.file, {
    cacheControl: '3600',
    contentType: params.file.type || 'image/jpeg',
    upsert: false,
  })

  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('animal_photos')
    .insert({
      id: photoId,
      company_id: params.companyId,
      animal_id: params.animalId,
      storage_path: storagePath,
      captured_at: capturedAt,
      caption: params.caption?.trim() || null,
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw insertError
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  return { ...(data as AnimalPhoto), url: signed?.signedUrl ?? null } satisfies AnimalPhotoWithUrl
}

export async function updateAnimalPhotoCapturedAt(photoId: string, capturedAt: string) {
  const { error } = await supabase
    .from('animal_photos')
    .update({ captured_at: capturedAt })
    .eq('id', photoId)

  if (error) throw error
}

export async function deleteAnimalPhoto(photo: Pick<AnimalPhoto, 'id' | 'storage_path'>) {
  const { error: dbError } = await supabase.from('animal_photos').delete().eq('id', photo.id)
  if (dbError) throw dbError

  await supabase.storage.from(BUCKET).remove([photo.storage_path])
}
