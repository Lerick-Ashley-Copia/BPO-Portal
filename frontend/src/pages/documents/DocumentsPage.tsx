import { useState } from 'react'
import { api, ApiError } from '../../services/api'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
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

export function DocumentsPage() {
  const { data, loading, error } = useApiData<Document[]>('/documents')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

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
