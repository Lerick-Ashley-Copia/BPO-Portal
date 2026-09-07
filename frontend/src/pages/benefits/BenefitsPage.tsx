import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { api, ApiError } from '../../services/api'
import type { Benefit } from './types'

function groupByCategory(benefits: Benefit[]): Map<string, Benefit[]> {
  const groups = new Map<string, Benefit[]>()
  for (const benefit of benefits) {
    const group = groups.get(benefit.category) ?? []
    group.push(benefit)
    groups.set(benefit.category, group)
  }
  return groups
}

function CreateForm({ onCreated }: { onCreated: (b: Benefit) => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [eligibility, setEligibility] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const created = await api.post<Benefit>('/benefits', {
        title,
        category,
        description,
        eligibility: eligibility || null,
      })
      onCreated(created)
      setTitle('')
      setCategory('')
      setDescription('')
      setEligibility('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create benefit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="ben-title" className="text-sm text-gray-600">Title</label>
          <input id="ben-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="ben-category" className="text-sm text-gray-600">Category</label>
          <input id="ben-category" required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="ben-description" className="text-sm text-gray-600">Description</label>
        <textarea id="ben-description" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label htmlFor="ben-eligibility" className="text-sm text-gray-600">Eligibility (optional)</label>
        <input id="ben-eligibility" value={eligibility} onChange={(e) => setEligibility(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {submitting ? 'Adding…' : 'Add benefit'}
      </button>
    </form>
  )
}

function BenefitCard({
  benefit,
  canManage,
  onDeleted,
}: {
  benefit: Benefit
  canManage: boolean
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/benefits/${benefit.id}`)
      onDeleted(benefit.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete')
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="font-medium">{benefit.title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{benefit.description}</p>
      {benefit.eligibility && <p className="mt-2 text-xs text-gray-500">Eligibility: {benefit.eligibility}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {canManage && (
        <button
          onClick={remove}
          disabled={deleting}
          className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
    </div>
  )
}

export function BenefitsPage() {
  const { user } = useAuth()
  const canManage = user?.roles.some((r) => r === 'hr' || r === 'admin') ?? false
  const [data, setData] = useState<Benefit[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Benefit[]>('/benefits')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold">Benefits</h1>

      {canManage && (
        <div className="mt-4">
          <CreateForm onCreated={(b) => setData((prev) => (prev ? [...prev, b] : [b]))} />
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No benefits published yet." />}

      {data && data.length > 0 && (
        <div className="mt-4 space-y-6">
          {Array.from(groupByCategory(data)).map(([category, benefits]) => (
            <section key={category}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{category}</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <BenefitCard
                    key={benefit.id}
                    benefit={benefit}
                    canManage={canManage}
                    onDeleted={(id) => setData((prev) => prev?.filter((b) => b.id !== id) ?? null)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
