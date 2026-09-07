export interface AuditLogEntry {
  id: string
  user: string
  action: string
  resource: string
  resourceId: string | null
  result: string
  createdAt: string
}
