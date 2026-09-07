export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: LeaveRequestStatus
  reviewComment: string | null
  createdAt: string
}
