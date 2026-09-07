export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-gray-500">{label}</p>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-gray-500">{label}</p>
}
