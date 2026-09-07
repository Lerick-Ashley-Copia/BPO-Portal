export interface AttendanceRecord {
  id: string
  employeeName: string
  date: string
  checkInAt: string
  checkOutAt: string | null
}
