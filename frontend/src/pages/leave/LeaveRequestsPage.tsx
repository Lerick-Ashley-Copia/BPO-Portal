import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { LeaveRequest, LeaveRequestStatus } from './types'

const statusColors: Record<LeaveRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const dateFmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function CreateForm({ onCreated }: { onCreated: (r: LeaveRequest) => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date')
      return
    }
    setSubmitting(true)
    try {
      const created = await api.post<LeaveRequest>('/leave/requests', {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: reason || undefined,
      })
      onCreated(created)
      setStartDate('')
      setEndDate('')
      setReason('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit leave request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Start date</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">End date</label>
          <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Reason (optional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {submitting ? 'Submitting…' : 'Request leave'}
      </button>
    </form>
  )
}

function ReviewRow({ request, onReviewed }: { request: LeaveRequest; onReviewed: (r: LeaveRequest) => void }) {
  const { guardedAction } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function review(action: 'approve' | 'reject') {
    guardedAction(['hr', 'admin'], async () => {
      setBusy(true)
      setError(null)
      try {
        const comment = action === 'reject' ? (window.prompt('Reason for rejecting (optional):') ?? undefined) : undefined
        const updated = await api.put<LeaveRequest>(`/leave/requests/${request.id}`, { action, comment })
        onReviewed(updated)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not update request')
      } finally {
        setBusy(false)
      }
    })
  }

  return (
    <li className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{request.employeeName}</span>
          <span className="ml-2 text-sm text-gray-500">
            {dateFmt(request.startDate)} – {dateFmt(request.endDate)} ({request.days} day{request.days === 1 ? '' : 's'})
          </span>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[request.status]}`}>
          {request.status}
        </span>
      </div>
      {request.reason && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{request.reason}</p>}
      {request.reviewComment && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Comment:</span> {request.reviewComment}
        </p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {request.status === 'pending' && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => review('approve')}
            disabled={busy}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => review('reject')}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  )
}

export function LeaveRequestsPage() {
  const { effectiveRoles } = useAuth()
  const isReviewer = effectiveRoles.some((r) => r === 'hr' || r === 'admin')
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<LeaveRequest[]>('/leave/requests')
      .then(setRequests)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leave Requests</h1>

      <div className="mt-4">
        <CreateForm onCreated={(r) => setRequests((prev) => (prev ? [r, ...prev] : [r]))} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {isReviewer ? 'All Requests' : 'My Requests'}
      </h2>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {requests && requests.length === 0 && <EmptyState label="No leave requests yet." />}

      {requests && requests.length > 0 && (
        <ul className="mt-2 space-y-3">
          {requests.map((r) => (
            <ReviewRow
              key={r.id}
              request={r}
              onReviewed={(updated) =>
                setRequests((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
