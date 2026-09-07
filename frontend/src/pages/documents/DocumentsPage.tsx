import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { api, ApiError } from '../../services/api'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import type { Document } from './types'

function groupByCategory(documents: Document[]): Map<string, Document[]> {
  const groups = new Map<string, Document[]>()
  for (const doc of documents) {
    const group = groups.get(doc.category) ?? []
    group.push(doc)
    groups.set(doc.category, group)
  }
  return groups
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const ROLES = ['employee', 'team_leader', 'manager', 'hr', 'admin']

function UploadForm({ onUploaded }: { onUploaded: (d: Document) => void }) {
  const { guardedAction } = useAuth()
  const [title, setTitle] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [accessLevel, setAccessLevel] = useState('employee')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Choose a file')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('File must be under 4MB')
      return
    }

    guardedAction(['hr', 'admin'], async () => {
      setUploading(true)
      try {
        const fileBase64 = await readFileAsBase64(file)
        const uploaded = await api.post<Document>('/documents', {
          title,
          categoryName,
          accessLevel,
          contentType: file.type || 'application/octet-stream',
          fileName: file.name,
          fileBase64,
        })
        onUploaded(uploaded)
        setTitle('')
        setCategoryName('')
        setFile(null)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not upload document')
      } finally {
        setUploading(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="doc-title" className="text-sm text-gray-600">Title</label>
          <input id="doc-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="doc-category" className="text-sm text-gray-600">Category</label>
          <input id="doc-category" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="doc-access" className="text-sm text-gray-600">Visible to</label>
          <select id="doc-access" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'employee' ? 'Everyone' : r}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="doc-file" className="text-sm text-gray-600">File (max 4MB)</label>
          <input id="doc-file" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={uploading} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  )
}

export function DocumentsPage() {
  const { effectiveRoles } = useAuth()
  const canManage = effectiveRoles.some((r) => r === 'hr' || r === 'admin')
  const [data, setData] = useState<Document[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Document[]>('/documents')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDownload(id: string) {
    setDownloadError(null)
    setDownloadingId(id)
    try {
      const { url } = await api.get<{ url: string }>(`/documents/${id}/download`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not generate download link')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Documents</h1>

      {canManage && (
        <div className="mt-4">
          <UploadForm onUploaded={(d) => setData((prev) => (prev ? [d, ...prev] : [d]))} />
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No documents available yet." />}
      {downloadError && <div className="mt-3"><ErrorState message={downloadError} /></div>}

      {data && data.length > 0 && (
        <div className="mt-4 space-y-6">
          {Array.from(groupByCategory(data)).map(([category, docs]) => (
            <section key={category}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {category}
              </h2>
              <ul className="mt-2 space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
                  >
                    <span className="font-medium">{doc.title}</span>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadingId === doc.id}
                      className="shrink-0 rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    >
                      {downloadingId === doc.id ? 'Preparing…' : 'Download'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
