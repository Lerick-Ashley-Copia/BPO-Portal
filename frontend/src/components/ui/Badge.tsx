import type { HTMLAttributes } from 'react'

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'purple' | 'blue'

const tones: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  green: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
}

export function Badge({
  tone = 'gray',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  )
}
