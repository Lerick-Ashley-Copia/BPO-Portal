import type { FormHTMLAttributes, HTMLAttributes } from 'react'

export const cardClass =
  'rounded-xl border border-black/5 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035]'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${cardClass} ${className}`} {...props} />
}

// Same surface styling as Card, but rendered as a <form> — used for
// the create/edit forms that share the bordered-box look throughout
// the app.
export function CardForm({ className = '', ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={`${cardClass} ${className}`} {...props} />
}
