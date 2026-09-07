import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { Announcement } from './types'

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function CreateForm({ onCreated }: { onCreated: (a: Announcement) => void }) {
  const { guardedAction } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    guardedAction(['hr', 'admin'], async () => {
      setError(null)
      setSubmitting(true)
      try {
        const created = await api.post<Announcement>('/announcements', { title, content, published })
        onCreated(created)
        setTitle('')
        setContent('')
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create announcement')
      } finally {
        setSubmitting(false)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="space-y-1">
        <label htmlFor="ann-title" className="text-sm text-gray-600">Title</label>
        <input
          id="ann-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="ann-content" className="text-sm text-gray-600">Content</label>
        <textarea
          id="ann-content"
          required
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publish immediately
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Posting…' : 'Post announcement'}
      </button>
    </form>
  )
}

function AnnouncementItem({
  announcement,
  canManage,
  onUpdated,
  onDeleted,
}: {
  announcement: Announcement
  canManage: boolean
  onUpdated: (a: Announcement) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(announcement.title)
  const [content, setContent] = useState(announcement.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { guardedAction } = useAuth()

  function save() {
    guardedAction(['hr', 'admin'], async () => {
      setSaving(true)
      setError(null)
      try {
        const updated = await api.put<Announcement>(`/announcements/${announcement.id}`, { title, content })
        onUpdated(updated)
        setEditing(false)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save')
      } finally {
        setSaving(false)
      }
    })
  }

  function remove() {
    guardedAction(['hr', 'admin'], async () => {
      setSaving(true)
      setError(null)
      try {
        await api.delete(`/announcements/${announcement.id}`)
        onDeleted(announcement.id)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not delete')
        setSaving(false)
      }
    })
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm font-medium"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-medium">{announcement.title}</h2>
        {announcement.publishAt && (
          <span className="shrink-0 text-xs text-gray-500">
            {dateFormatter.format(new Date(announcement.publishAt))}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{announcement.content}</p>
      {!announcement.published && (
        <span className="mt-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-300">
          Draft
        </span>
      )}
      {canManage && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            Edit
          </button>
          <button
            onClick={remove}
            disabled={saving}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  )
}

export function AnnouncementsPage() {
  const { effectiveRoles } = useAuth()
  const canManage = effectiveRoles.some((r) => r === 'hr' || r === 'admin')
  const [data, setData] = useState<Announcement[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Announcement[]>('/announcements')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold">Announcements</h1>

      {canManage && (
        <div className="mt-4">
          <CreateForm onCreated={(a) => setData((prev) => (prev ? [a, ...prev] : [a]))} />
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No announcements yet." />}

      {data && data.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.map((announcement) => (
            <AnnouncementItem
              key={announcement.id}
              announcement={announcement}
              canManage={canManage}
              onUpdated={(updated) =>
                setData((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? null)
              }
              onDeleted={(id) => setData((prev) => prev?.filter((a) => a.id !== id) ?? null)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
