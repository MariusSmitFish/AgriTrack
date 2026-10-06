import { supabase } from './supabase'
import type { AnimalDocument, AnimalDocumentFormData, AnimalDocumentWithUrl } from './types'
import { todayDateValue } from './inoculations'

const BUCKET = 'animal-documents'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const MAX_FILE_BYTES = 20 * 1024 * 1024

const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
}

export const documentAccept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,image/jpeg,image/png,image/webp'

export function emptyDocumentForm(): AnimalDocumentFormData {
  return {
    title: '',
    document_date: todayDateValue(),
    notes: '',
  }
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionForFile(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]+$/.test(fromName) ? fromName : ''
}

export function assertSupportedDocument(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File must be 20 MB or smaller.')
  }
  const ext = extensionForFile(file)
  if (!mimeByExtension[ext]) {
    throw new Error('Use a PDF, image, Word, or text file.')
  }
}

function contentTypeFor(file: File) {
  const ext = extensionForFile(file)
  return mimeByExtension[ext] ?? file.type
}

export async function fetchAnimalDocuments(animalId: string): Promise<AnimalDocumentWithUrl[]> {
  const { data, error } = await supabase
    .from('animal_documents')
    .select('*')
    .eq('animal_id', animalId)
    .order('document_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const documents = (data ?? []) as AnimalDocument[]
  if (documents.length === 0) return []

  return Promise.all(
    documents.map(async (document) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS)

      return {
        ...document,
        file_size: document.file_size == null ? null : Number(document.file_size),
        url: signed?.signedUrl ?? null,
      }
    }),
  )
}

export async function uploadAnimalDocument(params: {
  companyId: string
  animalId: string
  userId: string
  file: File
  form: AnimalDocumentFormData
}) {
  assertSupportedDocument(params.file)
  const title = params.form.title.trim()
  if (!title) throw new Error('Enter a document title.')

  const documentId = crypto.randomUUID()
  const ext = extensionForFile(params.file)
  const storagePath = `${params.companyId}/${params.animalId}/${documentId}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, params.file, {
    cacheControl: '3600',
    contentType: contentTypeFor(params.file),
    upsert: false,
  })

  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('animal_documents')
    .insert({
      id: documentId,
      company_id: params.companyId,
      animal_id: params.animalId,
      title,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: contentTypeFor(params.file),
      file_size: params.file.size,
      document_date: params.form.document_date || null,
      notes: params.form.notes.trim() || null,
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

  return { ...(data as AnimalDocument), url: signed?.signedUrl ?? null } satisfies AnimalDocumentWithUrl
}

export async function updateAnimalDocument(id: string, form: AnimalDocumentFormData) {
  const title = form.title.trim()
  if (!title) throw new Error('Enter a document title.')

  const { data, error } = await supabase
    .from('animal_documents')
    .update({
      title,
      document_date: form.document_date || null,
      notes: form.notes.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as AnimalDocument
}

export async function deleteAnimalDocument(document: Pick<AnimalDocument, 'id' | 'storage_path'>) {
  const { error } = await supabase.from('animal_documents').delete().eq('id', document.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([document.storage_path])
}
