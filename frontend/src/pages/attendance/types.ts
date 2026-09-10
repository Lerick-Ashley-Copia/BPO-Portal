export interface AttendanceRecord {
  id: string
  employeeId?: string
  employeeName: string
  date: string
  status: 'present' | 'absent'
  checkInAt: string | null
  checkOutAt: string | null
  checkInIp?: string | null
  checkInOffSite?: boolean
}
