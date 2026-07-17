import * as XLSX from 'xlsx'

export interface SheetPreview {
  name: string
  rows: string[][]
  originalRowCount: number
  truncated: boolean
}

export interface WorkbookPreview {
  sheetNames: string[]
  sheets: SheetPreview[]
}

export function findDefaultSheetIndex(workbook: WorkbookPreview): number {
  const firstNonEmpty = workbook.sheets.findIndex((sheet) => sheet.rows.length > 0)
  return firstNonEmpty === -1 ? 0 : firstNonEmpty
}

export function countSheetMatches(sheet: SheetPreview | undefined, query: string): number {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!sheet || !normalizedQuery) return 0
  return sheet.rows.reduce(
    (count, row) => count + row.filter(
      (cell) => cell.toLocaleLowerCase().includes(normalizedQuery),
    ).length,
    0,
  )
}

const CORRUPT_FILE_MESSAGE = 'Excel 文件可能已损坏或格式不受支持'

function isExcelContainer(data: Uint8Array): boolean {
  const isZip = data.length >= 4
    && data[0] === 0x50
    && data[1] === 0x4b
    && (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07)
  const isCompoundFile = data.length >= 8
    && data[0] === 0xd0
    && data[1] === 0xcf
    && data[2] === 0x11
    && data[3] === 0xe0
    && data[4] === 0xa1
    && data[5] === 0xb1
    && data[6] === 0x1a
    && data[7] === 0xe1
  return isZip || isCompoundFile
}

function toDisplayRows(
  worksheet: XLSX.WorkSheet,
  maxRows: number,
): { rows: string[][]; originalRowCount: number; truncated: boolean } {
  if (!worksheet['!ref']) return { rows: [], originalRowCount: 0, truncated: false }

  const sourceRange = XLSX.utils.decode_range(worksheet['!ref'])
  const originalRowCount = sourceRange.e.r - sourceRange.s.r + 1
  const previewRange = {
    s: sourceRange.s,
    e: { ...sourceRange.e, r: Math.min(sourceRange.e.r, sourceRange.s.r + maxRows - 1) },
  }
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(
    worksheet,
    {
      header: 1,
      raw: true,
      defval: '',
      blankrows: true,
      dateNF: 'yyyy-mm-dd',
      range: previewRange,
    },
  )
  const columnCount = sourceRange.e.c - sourceRange.s.c + 1
  const rows = rawRows.map((row) => Array.from(
    { length: columnCount },
    (_, columnIndex) => toDisplayString(row[columnIndex]),
  ))

  return { rows, originalRowCount, truncated: originalRowCount > maxRows }
}

function toDisplayString(value: string | number | boolean | Date | undefined): string {
  if (value === undefined || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value)
}

export function workbookToPreview(
  input: ArrayBuffer | Uint8Array,
  maxRows = 1000,
): WorkbookPreview {
  try {
    if (!Number.isSafeInteger(maxRows) || maxRows <= 0) throw new Error(CORRUPT_FILE_MESSAGE)
    const data = input instanceof Uint8Array ? input : new Uint8Array(input)
    if (!isExcelContainer(data)) throw new Error(CORRUPT_FILE_MESSAGE)

    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      cellFormula: false,
      bookDeps: false,
      bookFiles: false,
      bookProps: false,
      bookVBA: false,
    })
    if (workbook.SheetNames.length === 0) throw new Error(CORRUPT_FILE_MESSAGE)

    return {
      sheetNames: [...workbook.SheetNames],
      sheets: workbook.SheetNames.map((name) => ({
        name,
        ...toDisplayRows(workbook.Sheets[name] ?? {}, maxRows),
      })),
    }
  } catch {
    throw new Error(CORRUPT_FILE_MESSAGE)
  }
}
