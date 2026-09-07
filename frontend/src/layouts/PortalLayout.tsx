import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../auth/types'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/benefits', label: 'Benefits' },
  { to: '/hris', label: 'HRIS' },
  { to: '/reports', label: 'Weekly Reports', roles: ['team_leader', 'manager', 'hr', 'admin'] as const },
  { to: '/documents', label: 'Documents' },
  { to: '/users', label: 'Users', roles: ['admin'] as const },
  { to: '/audit-logs', label: 'Audit Logs', roles: ['admin'] as const },
]

const roleOptions: { value: Role; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'admin', label: 'Administrator' },
]

function RoleSwitcher() {
  const { user, viewAsRole, setViewAsRole } = useAuth()
  if (!user?.roles.includes('admin')) return null

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-sm text-gray-500">
      View as:
      <select
        value={viewAsRole ?? ''}
        onChange={(e) => setViewAsRole(e.target.value ? (e.target.value as Role) : null)}
        className="rounded border border-gray-300 bg-transparent px-1.5 py-1 text-sm dark:border-gray-700"
      >
        <option value="">My role (Admin)</option>
        {roleOptions.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PortalLayout() {
  const { user, logout, effectiveRoles } = useAuth()
  const visibleNavItems = navItems.filter(
    (item) => item.roles?.some((r) => effectiveRoles.includes(r)) ?? true,
  )

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <span className="min-w-0 truncate font-semibold">BPO Portal</span>
          <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm sm:gap-4">
            <RoleSwitcher />
            <span className="max-w-[40vw] truncate text-gray-500 sm:max-w-none">{user?.email}</span>
            <button
              onClick={logout}
              className="shrink-0 rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                'shrink-0 ' +
                (isActive ? 'font-medium text-blue-600' : 'text-gray-600 hover:text-gray-900')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
