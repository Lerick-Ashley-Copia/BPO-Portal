export interface Announcement {
  id: string
  title: string
  content: string
  published: boolean
  publishAt: string | null
  expireAt: string | null
}
