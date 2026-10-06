import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { AnimalDocumentFormData, AnimalDocumentWithUrl } from '../../lib/types'
import {
  assertSupportedDocument,
  deleteAnimalDocument,
  documentAccept,
  emptyDocumentForm,
  fetchAnimalDocuments,
  formatFileSize,
  updateAnimalDocument,
  uploadAnimalDocument,
} from '../../lib/animalDocuments'
import { formatInoculationDate } from '../../lib/inoculations'
import { filterBySearch } from '../../lib/search'
import { useClientPagination } from '../../lib/pagination'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { SearchField } from '../ui/SearchField'
import { Pagination } from '../ui/Pagination'
import {
  DesktopTable,
  EmptyState,
  MobileCard,
  MobileCardList,
} from '../layout/AppShell'

interface AnimalDocumentsPanelProps {
  animalId: string
  companyId: string
  userId: string
}

export function AnimalDocumentsPanel({ animalId, companyId, userId }: AnimalDocumentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<AnimalDocumentWithUrl[]>([])
  const [form, setForm] = useState<AnimalDocumentFormData>(emptyDocumentForm)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const filteredDocuments = useMemo(
    () =>
      filterBySearch(documents, deferredQuery, (document) => [
        document.title,
        document.file_name,
        document.notes,
        formatInoculationDate(document.document_date),
      ]),
    [documents, deferredQuery],
  )

  const {
    pageItems: pagedDocuments,
    page,
    setPage,
    totalPages,
    totalItems,
    start,
    end,
  } = useClientPagination(filteredDocuments, { resetKey: deferredQuery })

  const loadDocuments = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      setDocuments(await fetchAnimalDocuments(animalId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments(true)
  }, [animalId])

  const set = <K extends keyof AnimalDocumentFormData>(key: K, value: AnimalDocumentFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setForm(emptyDocumentForm())
    setSelectedFile(null)
    setEditingId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')
    try {
      assertSupportedDocument(file)
      setSelectedFile(file)
      if (!form.title.trim()) {
        const baseName = file.name.replace(/\.[^.]+$/, '')
        set('title', baseName)
      }
    } catch (err) {
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setError(err instanceof Error ? err.message : 'That file is not supported')
    }
  }

  const startEdit = (document: AnimalDocumentWithUrl) => {
    setEditingId(document.id)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setForm({
      title: document.title,
      document_date: document.document_date ?? '',
      notes: document.notes ?? '',
    })
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Enter a document title.')
      return
    }
    if (!editingId && !selectedFile) {
      setError('Choose a file to upload.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        const updated = await updateAnimalDocument(editingId, form)
        setDocuments((prev) =>
          prev.map((document) => (document.id === editingId ? { ...document, ...updated } : document)),
        )
        setSuccess('Document updated.')
      } else if (selectedFile) {
        const created = await uploadAnimalDocument({
          companyId,
          animalId,
          userId,
          file: selectedFile,
          form,
        })
        setDocuments((prev) => [created, ...prev])
        setSuccess('Document uploaded.')
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (document: AnimalDocumentWithUrl) => {
    if (!window.confirm(`Delete "${document.title}"?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteAnimalDocument(document)
      setDocuments((prev) => prev.filter((item) => item.id !== document.id))
      if (editingId === document.id) resetForm()
      setSuccess('Document deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="font-display font-semibold text-pasture-900">
          {editingId ? 'Edit document' : 'Supporting documents'}
        </h3>
        <p className="mt-1 text-sm text-soil-500">
          Upload registration papers, certificates, or other files. PDF, image, Word, and text files up to 20 MB.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {!editingId && (
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={documentAccept}
                className="hidden"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-soil-600">
                  {selectedFile.name}
                  {formatFileSize(selectedFile.size) ? ` · ${formatFileSize(selectedFile.size)}` : ''}
                </p>
              )}
            </div>
          )}
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Studbook certificate"
            required
          />
          <Input
            label="Document date"
            type="date"
            value={form.document_date}
            onChange={(e) => set('document_date', e.target.value)}
          />
          <div className="md:col-span-2">
            <label htmlFor="document-notes" className="block text-sm font-semibold text-soil-700">
              Notes
            </label>
            <textarea
              id="document-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-field-dark bg-white px-3 py-2.5 text-base outline-none focus:border-pasture-600 focus:ring-2 focus:ring-pasture-100 sm:text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? 'Saving...' : editingId ? 'Update document' : 'Upload document'}
            </Button>
            {(editingId || selectedFile) && (
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resetForm}>
                Cancel
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
            <h3 className="font-display font-semibold text-pasture-900">Uploaded files</h3>
            <p className="mt-1 text-sm text-soil-500">Open a file to view or download it.</p>
          </div>
          <p className="text-sm font-semibold text-soil-600">{documents.length}</p>
        </div>
        {loading ? (
          <EmptyState>Loading documents...</EmptyState>
        ) : documents.length === 0 ? (
          <EmptyState>No supporting documents yet for this animal.</EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <SearchField
                id="documents-search"
                value={query}
                onChange={setQuery}
                placeholder="Search title, file name, notes…"
                resultCount={filteredDocuments.length}
                totalCount={documents.length}
              />
            </div>
            {filteredDocuments.length === 0 ? (
              <EmptyState>No documents match your search.</EmptyState>
            ) : (
              <>
                <MobileCardList>
                  {pagedDocuments.map((document) => (
                    <MobileCard
                      key={document.id}
                      title={document.title}
                      subtitle={document.file_name}
                      fields={[
                        { label: 'Date', value: formatInoculationDate(document.document_date) },
                        { label: 'Size', value: formatFileSize(document.file_size) || '—' },
                      ]}
                      action={<DocumentActions document={document} onEdit={startEdit} onDelete={handleDelete} />}
                    />
                  ))}
                </MobileCardList>
                <DesktopTable>
                  <thead>
                    <tr className="border-b border-field-dark text-soil-500">
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">File</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDocuments.map((document) => (
                      <tr key={document.id} className="border-b border-field-dark/60">
                        <td className="py-3 font-medium text-soil-800">
                          {document.title}
                          {document.notes && (
                            <span className="mt-0.5 block text-xs font-normal text-soil-500">
                              {document.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-soil-600">
                          {document.file_name}
                          {formatFileSize(document.file_size) && (
                            <span className="mt-0.5 block text-xs text-soil-500">
                              {formatFileSize(document.file_size)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-soil-600">
                          {formatInoculationDate(document.document_date)}
                        </td>
                        <td className="py-3 text-right">
                          <DocumentActions document={document} onEdit={startEdit} onDelete={handleDelete} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DesktopTable>
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
    </div>
  )
}

function DocumentActions({
  document,
  onEdit,
  onDelete,
}: {
  document: AnimalDocumentWithUrl
  onEdit: (document: AnimalDocumentWithUrl) => void
  onDelete: (document: AnimalDocumentWithUrl) => void
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      {document.url ? (
        <a
          href={document.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-pasture-800 hover:text-pasture-700"
        >
          Open
        </a>
      ) : (
        <span className="text-xs text-soil-500">Unavailable</span>
      )}
      <button
        type="button"
        className="text-xs font-semibold text-pasture-800 hover:text-pasture-700"
        onClick={() => onEdit(document)}
      >
        Edit
      </button>
      <button
        type="button"
        className="text-xs font-semibold text-red-700 hover:text-red-800"
        onClick={() => onDelete(document)}
      >
        Delete
      </button>
    </div>
  )
}
