import { PageHeader } from './ui/PageHeader'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="This module is not built out yet." />
    </div>
  )
}
