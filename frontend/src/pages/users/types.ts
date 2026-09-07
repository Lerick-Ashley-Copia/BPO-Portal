import type { Role } from '../../auth/types'

export interface ManagedUser {
  id: string
  email: string
  name: string
  roles: Role[]
  passwordSet: boolean
  createdAt: string
}
