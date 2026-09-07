import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/benefits', label: 'Benefits' },
  { to: '/hris', label: 'HRIS' },
  { to: '/reports', label: 'Weekly Reports' },
  { to: '/documents', label: 'Documents' },
]

export function PortalLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <span className="font-semibold">JAE Philus Admin Portal</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{user?.email}</span>
            <button
              onClick={logout}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl flex gap-4 px-4 pb-3 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'font-medium text-blue-600' : 'text-gray-600 hover:text-gray-900'
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
