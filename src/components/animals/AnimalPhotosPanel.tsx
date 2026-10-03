import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { AnimalPhotoWithUrl } from '../../lib/types'
import {
  deleteAnimalPhoto,
  fetchAnimalPhotos,
  formatPhotoDate,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  updateAnimalPhotoCapturedAt,
  uploadAnimalPhoto,
} from '../../lib/animalPhotos'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { SearchField } from '../ui/SearchField'
import { Pagination } from '../ui/Pagination'
import { EmptyState } from '../layout/AppShell'

interface AnimalPhotosPanelProps {
  animalId: string
  companyId: string
  userId: string
}

export function AnimalPhotosPanel({ animalId, companyId, userId }: AnimalPhotosPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<AnimalPhotoWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [capturedAt, setCapturedAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [caption, setCaption] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [viewerPhoto, setViewerPhoto] = useState<AnimalPhotoWithUrl | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filteredPhotos = useMemo(
    () =>
      filterBySearch(photos, deferredQuery, (photo) => [
        photo.caption,
        formatPhotoDate(photo.captured_at),
      ]),
    [photos, deferredQuery],
  )

  const {
    pageItems: pagedPhotos,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredPhotos, { resetKey: deferredQuery, pageSize: 12 })

  const loadPhotos = async () => {
    setLoading(true)
    setError('')
    try {
      setPhotos(await fetchAnimalPhotos(animalId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPhotos()
  }, [animalId])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const clearDraft = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSelectedFile(null)
    setCaption('')
    setCapturedAt(toDatetimeLocalValue(new Date()))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    setError('')
    setSuccess('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))

    // Prefer file last-modified as a sensible auto date when available
    if (file.lastModified) {
      setCapturedAt(toDatetimeLocalValue(new Date(file.lastModified)))
    } else {
      setCapturedAt(toDatetimeLocalValue(new Date()))
    }
  }

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('Choose or capture a photo first.')
      return
    }

    const iso = fromDatetimeLocalValue(capturedAt)
    if (!iso) {
      setError('Enter a valid capture date.')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const photo = await uploadAnimalPhoto({
        companyId,
        animalId,
        userId,
        file: selectedFile,
        capturedAt: iso,
        caption,
      })
      setPhotos((prev) => [photo, ...prev].sort((a, b) => b.captured_at.localeCompare(a.captured_at)))
      clearDraft()
      setSuccess('Photo added.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const startEditDate = (photo: AnimalPhotoWithUrl) => {
    setEditingId(photo.id)
    setEditDate(toDatetimeLocalValue(photo.captured_at))
    setError('')
    setSuccess('')
  }

  const saveEditDate = async (photoId: string) => {
    const iso = fromDatetimeLocalValue(editDate)
    if (!iso) {
      setError('Enter a valid capture date.')
      return
    }

    setSavingDate(true)
    setError('')
    try {
      await updateAnimalPhotoCapturedAt(photoId, iso)
      setPhotos((prev) =>
        prev
          .map((p) => (p.id === photoId ? { ...p, captured_at: iso } : p))
          .sort((a, b) => b.captured_at.localeCompare(a.captured_at)),
      )
      setEditingId(null)
      setSuccess('Photo date updated.')
      if (viewerPhoto?.id === photoId) {
        setViewerPhoto((current) => (current ? { ...current, captured_at: iso } : current))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update date')
    } finally {
      setSavingDate(false)
    }
  }

  const handleDelete = async (photo: AnimalPhotoWithUrl) => {
    if (!window.confirm('Delete this photo?')) return

    setError('')
    setSuccess('')
    try {
      await deleteAnimalPhoto(photo)
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      if (viewerPhoto?.id === photo.id) setViewerPhoto(null)
      setSuccess('Photo deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <h3 className="font-display font-semibold text-pasture-900">Add photo</h3>
        <p className="mt-1 text-sm text-soil-500">
          Capture or upload a photo. The date is filled automatically and you can edit it.
        </p>

        <form onSubmit={handleUpload} className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              Take or choose photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {previewUrl && (
            <div className="section-inset overflow-hidden rounded-2xl">
              <img src={previewUrl} alt="Selected animal" className="max-h-72 w-full object-contain" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Captured date"
              type="datetime-local"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              required
            />
            <Input
              label="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. After weaning"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={uploading || !selectedFile} className="w-full sm:w-auto">
              {uploading ? 'Uploading...' : 'Save photo'}
            </Button>
            {selectedFile && (
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={clearDraft}>
                Clear
              </Button>
            )}
          </div>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-pasture-800">{success}</p>}
      </Card>

      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-pasture-900">Photo history</h3>
            <p className="mt-1 text-sm text-soil-500">Newest first — tap a photo to enlarge.</p>
          </div>
          <p className="text-sm font-semibold text-soil-600">{photos.length}</p>
        </div>

        {loading ? (
          <EmptyState>Loading photos...</EmptyState>
        ) : photos.length === 0 ? (
          <EmptyState>No photos yet for this animal.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="photos-search"
                value={query}
                onChange={setQuery}
                placeholder="Search caption or date…"
                resultCount={filteredPhotos.length}
                totalCount={photos.length}
              />
            </div>
            {filteredPhotos.length === 0 ? (
              <EmptyState>No photos match your search.</EmptyState>
            ) : (
          <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pagedPhotos.map((photo) => (
              <article
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-field-dark bg-panel-muted shadow-sm"
              >
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => setViewerPhoto(photo)}
                  aria-label={`View photo from ${formatPhotoDate(photo.captured_at)}`}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Animal photo'}
                      className="aspect-square w-full object-cover transition hover:opacity-95"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-field text-sm text-soil-500">
                      Unavailable
                    </div>
                  )}
                </button>

                <div className="space-y-2 p-3">
                  {editingId === photo.id ? (
                    <div className="space-y-2">
                      <Input
                        label="Captured date"
                        type="datetime-local"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          className="w-full"
                          disabled={savingDate}
                          onClick={() => saveEditDate(photo.id)}
                        >
                          {savingDate ? 'Saving...' : 'Save date'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-pasture-900">
                        {formatPhotoDate(photo.captured_at)}
                      </p>
                      {photo.caption && (
                        <p className="line-clamp-2 text-xs text-soil-500">{photo.caption}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-pasture-800 hover:text-pasture-700"
                          onClick={() => startEditDate(photo)}
                        >
                          Edit date
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 hover:text-red-800"
                          onClick={() => handleDelete(photo)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            start={start}
            end={end}
            onPageChange={setPage}
          />
          </>
            )}
          </>
        )}
      </Card>

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-soil-800/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setViewerPhoto(null)}
        >
          <div
            className="max-h-full w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {viewerPhoto.url ? (
              <img
                src={viewerPhoto.url}
                alt={viewerPhoto.caption || 'Animal photo'}
                className="max-h-[70vh] w-full object-contain bg-soil-800"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-soil-500">Photo unavailable</div>
            )}
            <div className="space-y-3 p-4 sm:p-5">
              <div>
                <p className="font-display font-semibold text-pasture-900">
                  {formatPhotoDate(viewerPhoto.captured_at)}
                </p>
                {viewerPhoto.caption && (
                  <p className="mt-1 text-sm text-soil-600">{viewerPhoto.caption}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    startEditDate(viewerPhoto)
                    setViewerPhoto(null)
                  }}
                >
                  Edit date
                </Button>
                <Button type="button" className="w-full sm:w-auto" onClick={() => setViewerPhoto(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
