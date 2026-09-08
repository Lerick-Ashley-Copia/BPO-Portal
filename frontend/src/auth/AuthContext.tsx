import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../services/api'
import type { AuthUser, Role } from './types'

interface PendingAction {
  requiredRoles: Role[]
  run: () => void
}

export interface AttendanceStatus {
  checkedIn: boolean
  checkedOut: boolean
  status: 'present' | 'absent' | null
  checkInAt: string | null
  checkOutAt: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setSession: (token: string, user: AuthUser) => void
  viewAsRole: Role | null
  setViewAsRole: (role: Role | null) => void
  effectiveRoles: Role[]
  guardedAction: (requiredRoles: Role[], run: () => void) => void
  attendanceStatus: AttendanceStatus | null
  refreshAttendance: () => void
  justCheckedIn: boolean
  dismissJustCheckedIn: () => void
  checkInError: string | null
  retryCheckIn: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const roleLabels: Record<Role, string> = {
  employee: 'Employee',
  team_leader: 'Team Leader',
  manager: 'Manager',
  hr: 'HR',
  admin: 'Administrator',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewAsRole, setViewAsRole] = useState<Role | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null)
  const [justCheckedIn, setJustCheckedIn] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const autoCheckInTried = useRef(false)

  function refreshAttendance() {
    api
      .get<AttendanceStatus>('/leave/attendance/today')
      .then(setAttendanceStatus)
      .catch(() => setAttendanceStatus(null))
  }

  function dismissJustCheckedIn() {
    setJustCheckedIn(false)
  }

  function attemptCheckIn() {
    api
      .post<AttendanceStatus>('/leave/attendance/checkin')
      .then((status) => {
        setAttendanceStatus(status)
        setJustCheckedIn(true)
        setCheckInError(null)
      })
      .catch((err) => {
        // A 404 means there's no employee profile on file yet — not a
        // real failure, nothing to surface. Anything else (a dropped
        // request, a transient server error) is worth telling the
        // person about, with a way to retry, instead of silently
        // leaving them un-checked-in for the day.
        if (err instanceof ApiError && err.status === 404) return
        setCheckInError(err instanceof ApiError ? err.message : 'Could not check in automatically')
      })
  }

  function retryCheckIn() {
    setCheckInError(null)
    attemptCheckIn()
  }

  useEffect(() => {
    if (user) {
      autoCheckInTried.current = false
      setCheckInError(null)
      refreshAttendance()
    } else {
      setAttendanceStatus(null)
      setJustCheckedIn(false)
      setCheckInError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Login itself is the check-in trigger — no separate "Check In"
  // button to click or forget. Fires once per session, the first time
  // we learn today has no record yet.
  useEffect(() => {
    if (!user || !attendanceStatus || attendanceStatus.checkedIn || autoCheckInTried.current) return
    autoCheckInTried.current = true
    attemptCheckIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, attendanceStatus])

  useEffect(() => {
    const token = localStorage.getItem('bpo_token')
    if (!token) {
      setLoading(false)
      return
    }

    api
      .get<AuthUser>('/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('bpo_token'))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const { token, user: loggedInUser } = await api.post<{ token: string; user: AuthUser }>(
      '/auth/login',
      { email, password },
    )
    localStorage.setItem('bpo_token', token)
    setUser(loggedInUser)
  }

  function logout() {
    localStorage.removeItem('bpo_token')
    setUser(null)
    setViewAsRole(null)
  }

  function setSession(token: string, sessionUser: AuthUser) {
    localStorage.setItem('bpo_token', token)
    setUser(sessionUser)
  }

  // Only real admins can simulate a role — otherwise a simulated
  // "employee" could simulate their way back to admin.
  const canSimulate = user?.roles.includes('admin') ?? false
  const effectiveRoles = canSimulate && viewAsRole ? [viewAsRole] : (user?.roles ?? [])

  // The backend always enforces permissions off the real JWT, so
  // view-as-role is a UI-only preview — guardedAction is what makes
  // that preview meaningful: an action the simulated role couldn't
  // really do still pauses for confirmation instead of silently
  // succeeding through the real admin token underneath it.
  function guardedAction(requiredRoles: Role[], run: () => void) {
    const allowedForReal = user?.roles.some((r) => requiredRoles.includes(r)) ?? false
    const allowedForSimulated = requiredRoles.length === 0 || requiredRoles.some((r) => effectiveRoles.includes(r))

    if (allowedForSimulated || !allowedForReal) {
      run()
      return
    }

    setPendingAction({ requiredRoles, run })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        setSession,
        viewAsRole,
        setViewAsRole,
        effectiveRoles,
        guardedAction,
        attendanceStatus,
        refreshAttendance,
        justCheckedIn,
        dismissJustCheckedIn,
        checkInError,
        retryCheckIn,
      }}
    >
      {children}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-gray-900">
            <h2 className="font-semibold">Action not allowed for this role</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              The role you're viewing as ({viewAsRole ? roleLabels[viewAsRole] : ''}) can't do this.
              You're really an Administrator — proceed anyway?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  pendingAction.run()
                  setPendingAction(null)
                }}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Proceed as Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { ApiError }
