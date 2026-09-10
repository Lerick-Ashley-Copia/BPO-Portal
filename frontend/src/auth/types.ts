export type Role = 'employee' | 'team_leader' | 'manager' | 'hr' | 'admin'

export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  team_leader: 'Team Leader',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Administrator',
}

export interface AuthUser {
  id: string
  email: string
  firstName: string
  name: string
  roles: Role[]
}
