import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { useApiData } from '../../hooks/useApiData'
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

export function BenefitsPage() {
  const { data, loading, error } = useApiData<Benefit[]>('/benefits')

  return (
    <div>
      <h1 className="text-2xl font-semibold">Benefits</h1>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <EmptyState label="No benefits published yet." />}

      {data && data.length > 0 && (
        <div className="mt-4 space-y-6">
          {Array.from(groupByCategory(data)).map(([category, benefits]) => (
            <section key={category}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {category}
              </h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <h3 className="font-medium">{benefit.title}</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {benefit.description}
                    </p>
                    {benefit.eligibility && (
                      <p className="mt-2 text-xs text-gray-500">
                        Eligibility: {benefit.eligibility}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
