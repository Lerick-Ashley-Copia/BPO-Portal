export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm backdrop-blur-sm dark:border-red-900 dark:bg-red-950/70 dark:text-red-300">
      {message}
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 py-10 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
      {label}
    </div>
  )
}
