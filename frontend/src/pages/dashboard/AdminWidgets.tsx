import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../services/api'
import { ErrorState, LoadingState } from '../../components/AsyncState'
import type { AuditLogEntry } from '../audit-logs/types'

interface Stats {
  employeeCount: number
  teamCount: number
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })

export function AdminWidgets() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentActions, setRecentActions] = useState<AuditLogEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<{ id: string }[]>('/employees'),
      api.get<{ teams: { id: string }[] }>('/directory'),
      api.get<AuditLogEntry[]>('/audit-logs?limit=5'),
    ])
      .then(([employees, dir, logs]) => {
        setStats({ employeeCount: employees.length, teamCount: dir.teams.length })
        setRecentActions(logs)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState label="Loading admin overview…" />
  if (error) return <ErrorState message={error} />
  if (!stats) return null

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Admin Overview
      </h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="text-2xl font-semibold">{stats.employeeCount}</div>
          <div className="text-sm text-gray-500">Total Employees</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="text-2xl font-semibold">{stats.teamCount}</div>
          <div className="text-sm text-gray-500">Active Teams</div>
        </div>
      </div>

      {recentActions && recentActions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent Administrative Actions
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {recentActions.map((log) => (
              <li key={log.id} className="text-gray-600 dark:text-gray-400">
                <span className="text-gray-400">{dateFormatter.format(new Date(log.createdAt))}</span>{' '}
                {log.user} — {log.action} {log.resource}
              </li>
            ))}
          </ul>
          <Link to="/audit-logs" className="mt-2 inline-block text-sm text-blue-600">
            View all audit logs →
          </Link>
        </div>
      )}
    </section>
  )
}
