import ExcelJS from 'exceljs'

export interface AttendanceReportRow {
  date: Date
  employeeName: string
  status: 'present' | 'absent'
  checkInAt: Date | null
  checkOutAt: Date | null
}

const dateFmt = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

const timeFmt = (d: Date | null) =>
  d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : '—'

// Rows arrive already sorted by date. Grouped into one section per
// date (a bold header row, then that day's records) rather than one
// flat table, so a multi-day range export reads the way a paper
// attendance sheet would.
export async function buildAttendanceXlsx(rows: AttendanceReportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Attendance')
  sheet.columns = [
    { header: '', key: 'employeeName', width: 28 },
    { header: '', key: 'checkInAt', width: 16 },
    { header: '', key: 'checkOutAt', width: 16 },
  ]

  let currentDateKey: string | null = null
  for (const row of rows) {
    const dateKey = row.date.toISOString().slice(0, 10)
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey
      const headerRow = sheet.addRow([dateFmt(row.date)])
      headerRow.font = { bold: true }
      headerRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      }
      sheet.mergeCells(headerRow.number, 1, headerRow.number, 3)

      const columnHeaderRow = sheet.addRow(['Employee', 'Check In', 'Check Out'])
      columnHeaderRow.font = { bold: true, size: 10 }
    }

    if (row.status === 'absent') {
      sheet.addRow([row.employeeName, 'Absent', '—'])
    } else {
      sheet.addRow([row.employeeName, timeFmt(row.checkInAt), timeFmt(row.checkOutAt)])
    }
  }

  if (rows.length === 0) {
    sheet.addRow(['No attendance records in this range.'])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
