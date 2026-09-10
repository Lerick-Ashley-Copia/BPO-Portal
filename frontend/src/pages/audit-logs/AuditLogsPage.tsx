import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
import type { AuditLogEntry } from './types'

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })

export function AuditLogsPage() {
  const { data, loading, error } = useApiData<AuditLogEntry[]>('/audit-logs?limit=100')

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit Logs</h1>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No administrative actions recorded yet." />}

      {data && data.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Resource</th>
                <th className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 text-gray-500">{dateFormatter.format(new Date(log.createdAt))}</td>
                  <td className="py-2 pr-4">{log.user}</td>
                  <td className="py-2 pr-4">{log.action}</td>
                  <td className="py-2 pr-4">
                    {log.resource}
                    {log.resourceId && <span className="text-gray-400"> #{log.resourceId.slice(0, 8)}</span>}
                  </td>
                  <td className="py-2">
                    <span
                      className={
                        log.result === 'success'
                          ? 'text-green-700 dark:text-green-500'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {log.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
