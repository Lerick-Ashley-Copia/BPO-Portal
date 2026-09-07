export type Role = 'employee' | 'team_leader' | 'manager' | 'hr' | 'admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  roles: Role[]
}
