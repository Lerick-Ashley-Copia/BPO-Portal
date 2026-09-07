import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface ReportData {
  client?: string
  headcount?: number
  attendance?: string
  productivity?: string
  qa?: string
  sla?: string
  performanceMetrics?: string
  issues?: string
  achievements?: string
  actionItems?: string
  managerComments?: string
}

export interface ReportExportInput {
  teamName: string
  periodStart: Date
  periodEnd: Date
  status: string
  data: ReportData
}

const dateFmt = (d: Date) => d.toISOString().slice(0, 10)

function rows(input: ReportExportInput): [string, string][] {
  const { data } = input
  return [
    ['Team', input.teamName],
    ['Period', `${dateFmt(input.periodStart)} to ${dateFmt(input.periodEnd)}`],
    ['Status', input.status],
    ['Client/Account', data.client ?? ''],
    ['Headcount', data.headcount != null ? String(data.headcount) : ''],
    ['Attendance', data.attendance ?? ''],
    ['Productivity', data.productivity ?? ''],
    ['Quality/QA', data.qa ?? ''],
    ['SLA', data.sla ?? ''],
    ['Performance Metrics', data.performanceMetrics ?? ''],
    ['Issues', data.issues ?? ''],
    ['Achievements', data.achievements ?? ''],
    ['Action Items', data.actionItems ?? ''],
    ['Manager Comments', data.managerComments ?? ''],
  ]
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function buildCsv(input: ReportExportInput): Buffer {
  const lines = rows(input).map(([field, value]) => `${csvEscape(field)},${csvEscape(value)}`)
  return Buffer.from(['Field,Value', ...lines].join('\r\n'), 'utf-8')
}

export async function buildXlsx(input: ReportExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Weekly Report')
  sheet.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  for (const [field, value] of rows(input)) {
    sheet.addRow({ field, value })
  }
  sheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildPdf(input: ReportExportInput): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([612, 792]) // Letter size
  const marginX = 50
  let y = 742

  page.drawText('Weekly Report', { x: marginX, y, size: 18, font: boldFont })
  y -= 30

  for (const [field, value] of rows(input)) {
    if (y < 60) {
      page = doc.addPage([612, 792])
      y = 742
    }
    page.drawText(`${field}:`, { x: marginX, y, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    y -= 16

    const text = value || '—'
    const maxCharsPerLine = 95
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
      if (y < 60) {
        page = doc.addPage([612, 792])
        y = 742
      }
      page.drawText(text.slice(i, i + maxCharsPerLine), { x: marginX + 10, y, size: 10, font })
      y -= 14
    }
    y -= 6
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
