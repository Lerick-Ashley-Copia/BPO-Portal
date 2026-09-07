import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import type { Announcement } from './types'

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

export function AnnouncementsPage() {
  const { data, loading, error } = useApiData<Announcement[]>('/announcements')

  return (
    <div>
      <h1 className="text-2xl font-semibold">Announcements</h1>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No announcements yet." />}

      {data && data.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.map((announcement) => (
            <li
              key={announcement.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-medium">{announcement.title}</h2>
                {announcement.publishAt && (
                  <span className="shrink-0 text-xs text-gray-500">
                    {dateFormatter.format(new Date(announcement.publishAt))}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {announcement.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
