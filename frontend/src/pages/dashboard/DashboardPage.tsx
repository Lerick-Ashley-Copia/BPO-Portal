import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import type { Announcement } from '../announcements/types'
import { AdminWidgets } from './AdminWidgets'
import { CheckInPrompt } from './CheckInPrompt'

const roleLabels: Record<string, string> = {
  employee: 'Employee',
  team_leader: 'Team Leader',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Administrator',
}

const quickLinks = [
  { to: '/announcements', label: 'Announcements' },
  { to: '/benefits', label: 'Benefits' },
  { to: '/hris', label: 'HRIS' },
  { to: '/reports', label: 'Weekly Reports' },
  { to: '/leave', label: 'Leave Requests' },
  { to: '/documents', label: 'Documents' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error } = useApiData<Announcement[]>('/announcements')
  const latest = data?.slice(0, 3) ?? []

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome{user?.name ? `, ${user.name}` : ''}
      </h1>
      {user && (
        <p className="mt-1 text-sm text-gray-500">
          {user.roles.map((role) => roleLabels[role] ?? role).join(', ')}
        </p>
      )}

      {user?.roles.includes('admin') && <AdminWidgets />}

      <div className="mt-6">
        <CheckInPrompt />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Latest Announcements
          </h2>

          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {data && latest.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">Nothing posted yet.</p>
          )}

          {latest.length > 0 && (
            <ul className="mt-2 space-y-3">
              {latest.map((announcement) => (
                <li
                  key={announcement.id}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                >
                  <h3 className="font-medium">{announcement.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {announcement.content}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {data && data.length > 0 && (
            <Link to="/announcements" className="mt-3 inline-block text-sm text-blue-600">
              View all announcements →
            </Link>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Quick Links
          </h2>
          <ul className="mt-2 space-y-2">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="block rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
