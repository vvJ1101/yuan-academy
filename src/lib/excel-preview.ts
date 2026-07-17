import * as XLSX from 'xlsx'

export interface SheetPreview {
  name: string
  rows: string[][]
  originalRowCount: number
  originalColumnCount: number
  truncated: boolean
  columnsTruncated: boolean
  totalLimitTruncated: boolean
}

export interface WorkbookPreview {
  sheetNames: string[]
  sheets: SheetPreview[]
  originalSheetCount: number
  sheetsTruncated: boolean
  renderedCellCount: number
  totalCellsTruncated: boolean
}

export const EXCEL_PREVIEW_LIMITS = {
  maxRows: 1000,
  maxColumns: 100,
  maxSheets: 20,
  maxTotalCells: 100_000,
} as const

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
  remainingCells: number,
): Omit<SheetPreview, 'name'> {
  if (!worksheet['!ref']) {
    return {
      rows: [],
      originalRowCount: 0,
      originalColumnCount: 0,
      truncated: false,
      columnsTruncated: false,
      totalLimitTruncated: false,
    }
  }

  const sourceRange = XLSX.utils.decode_range(worksheet['!ref'])
  const originalRowCount = sourceRange.e.r - sourceRange.s.r + 1
  const originalColumnCount = sourceRange.e.c - sourceRange.s.c + 1
  const previewColumnCount = Math.min(originalColumnCount, EXCEL_PREVIEW_LIMITS.maxColumns)
  const rowLimitBeforeTotal = Math.min(originalRowCount, maxRows)
  const previewRowCount = Math.min(
    rowLimitBeforeTotal,
    previewColumnCount > 0 ? Math.floor(remainingCells / previewColumnCount) : 0,
  )
  if (previewRowCount === 0) {
    return {
      rows: [],
      originalRowCount,
      originalColumnCount,
      truncated: originalRowCount > maxRows,
      columnsTruncated: originalColumnCount > previewColumnCount,
      totalLimitTruncated: rowLimitBeforeTotal > 0,
    }
  }
  const previewRange = {
    s: sourceRange.s,
    e: {
      r: sourceRange.s.r + previewRowCount - 1,
      c: sourceRange.s.c + previewColumnCount - 1,
    },
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
  const rows = rawRows.map((row) => Array.from(
    { length: previewColumnCount },
    (_, columnIndex) => toDisplayString(row[columnIndex]),
  ))

  return {
    rows,
    originalRowCount,
    originalColumnCount,
    truncated: originalRowCount > maxRows,
    columnsTruncated: originalColumnCount > previewColumnCount,
    totalLimitTruncated: previewRowCount < rowLimitBeforeTotal,
  }
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
  requestedMaxRows: number = EXCEL_PREVIEW_LIMITS.maxRows,
): WorkbookPreview {
  try {
    if (!Number.isSafeInteger(requestedMaxRows) || requestedMaxRows <= 0) throw new Error(CORRUPT_FILE_MESSAGE)
    const maxRows = Math.min(requestedMaxRows, EXCEL_PREVIEW_LIMITS.maxRows)
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

    const selectedSheetNames = workbook.SheetNames.slice(0, EXCEL_PREVIEW_LIMITS.maxSheets)
    let remainingCells = EXCEL_PREVIEW_LIMITS.maxTotalCells
    const sheets = selectedSheetNames.map((name) => {
      const sheet = {
        name,
        ...toDisplayRows(workbook.Sheets[name] ?? {}, maxRows, remainingCells),
      }
      remainingCells -= sheet.rows.length * Math.min(
        sheet.originalColumnCount,
        EXCEL_PREVIEW_LIMITS.maxColumns,
      )
      return sheet
    })
    const renderedCellCount = EXCEL_PREVIEW_LIMITS.maxTotalCells - remainingCells

    return {
      sheetNames: [...selectedSheetNames],
      sheets,
      originalSheetCount: workbook.SheetNames.length,
      sheetsTruncated: selectedSheetNames.length < workbook.SheetNames.length,
      renderedCellCount,
      totalCellsTruncated: sheets.some((sheet) => sheet.totalLimitTruncated),
    }
  } catch {
    throw new Error(CORRUPT_FILE_MESSAGE)
  }
}
