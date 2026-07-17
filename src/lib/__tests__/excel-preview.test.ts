import assert from 'node:assert/strict'
import test from 'node:test'

import * as XLSX from 'xlsx'

import { countSheetMatches, findDefaultSheetIndex, workbookToPreview } from '../excel-preview'

function createWorkbookBuffer(
  sheets: Array<{ name: string; rows: unknown[][] }>,
  bookType: 'xlsx' | 'xls' = 'xlsx',
): Buffer {
  const workbook = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  }
  return XLSX.write(workbook, { type: 'buffer', bookType, cellDates: true }) as Buffer
}

test('converts multiple Sheets into rectangular display matrices', () => {
  const preview = workbookToPreview(createWorkbookBuffer([
    { name: '员工', rows: [['姓名', '部门'], ['张三', '市场部']] },
    { name: '数据', rows: [['金额'], [1234.5]] },
  ]))

  assert.deepEqual(preview.sheetNames, ['员工', '数据'])
  assert.deepEqual(preview.sheets[0], {
    name: '员工',
    rows: [['姓名', '部门'], ['张三', '市场部']],
    originalRowCount: 2,
    originalColumnCount: 2,
    truncated: false,
    columnsTruncated: false,
    totalLimitTruncated: false,
  })
  assert.deepEqual(preview.sheets[1]?.rows, [['金额'], ['1234.5']])
})

test('preserves empty Sheets and Unicode cells', () => {
  const preview = workbookToPreview(createWorkbookBuffer([
    { name: '空表', rows: [] },
    { name: '国际化', rows: [['中文', '日本語', 'emoji'], ['你好', 'こんにちは', '🌏']] },
  ]))

  assert.deepEqual(preview.sheets[0], {
    name: '空表',
    rows: [],
    originalRowCount: 0,
    originalColumnCount: 0,
    truncated: false,
    columnsTruncated: false,
    totalLimitTruncated: false,
  })
  assert.deepEqual(preview.sheets[1]?.rows[1], ['你好', 'こんにちは', '🌏'])
})

test('limits rendered rows while retaining the original row count', () => {
  const rows = Array.from({ length: 1001 }, (_, index) => [`第 ${index + 1} 行`])
  const preview = workbookToPreview(createWorkbookBuffer([{ name: '大表', rows }]))

  assert.equal(preview.sheets[0]?.rows.length, 1000)
  assert.equal(preview.sheets[0]?.rows[999]?.[0], '第 1000 行')
  assert.equal(preview.sheets[0]?.originalRowCount, 1001)
  assert.equal(preview.sheets[0]?.truncated, true)
})

test('does not allow callers to raise the hard row ceiling', () => {
  const rows = Array.from({ length: 1001 }, (_, index) => [`第 ${index + 1} 行`])
  const preview = workbookToPreview(createWorkbookBuffer([{ name: '大表', rows }]), 10_000)

  assert.equal(preview.sheets[0]?.rows.length, 1000)
  assert.equal(preview.sheets[0]?.truncated, true)
})

test('formats dates and numbers as display strings without evaluating formulas', () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['日期', '数字', '公式'],
    [new Date(2026, 6, 17), 42.25, null],
  ], { cellDates: true })
  worksheet.C2 = { t: 'n', f: '1+1' }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '类型')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellDates: true }) as Buffer

  const preview = workbookToPreview(buffer)

  assert.match(preview.sheets[0]?.rows[1]?.[0] ?? '', /^2026[-/]0?7[-/]17$/)
  assert.equal(preview.sheets[0]?.rows[1]?.[1], '42.25')
  assert.equal(preview.sheets[0]?.rows[1]?.[2], '')
})

test('supports legacy XLS workbooks', () => {
  const preview = workbookToPreview(createWorkbookBuffer([
    { name: '旧格式', rows: [['项目'], ['可读']] },
  ], 'xls'))

  assert.deepEqual(preview.sheets[0]?.rows, [['项目'], ['可读']])
})

test('returns a Chinese error for corrupt or unsupported input', () => {
  assert.throws(
    () => workbookToPreview(Buffer.from('not an excel workbook')),
    (error: unknown) => error instanceof Error
      && error.message === 'Excel 文件可能已损坏或格式不受支持',
  )
})

test('opens the first non-empty Sheet by default', () => {
  const preview = workbookToPreview(createWorkbookBuffer([
    { name: '说明', rows: [] },
    { name: '明细', rows: [['项目'], ['内容']] },
  ]))

  assert.equal(findDefaultSheetIndex(preview), 1)
})

test('counts matching cells in the current Sheet case-insensitively', () => {
  const preview = workbookToPreview(createWorkbookBuffer([
    { name: '搜索', rows: [['Academy', 'academy 资料'], ['其他', 'ACADEMY']] },
  ]))

  assert.equal(countSheetMatches(preview.sheets[0], ' academy '), 3)
  assert.equal(countSheetMatches(preview.sheets[0], ''), 0)
})

test('caps an adversarial XFD range before allocating preview rows', () => {
  const worksheet = XLSX.utils.aoa_to_sheet([['仅有一个值'], ['第二行']])
  worksheet['!ref'] = 'A1:XFD2'
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '稀疏超宽表')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const preview = workbookToPreview(buffer)
  const sheet = preview.sheets[0]

  assert.equal(sheet?.originalColumnCount, 16_384)
  assert.equal(sheet?.rows.length, 2)
  assert.equal(sheet?.rows[0]?.length, 100)
  assert.equal(sheet?.columnsTruncated, true)
  assert.equal(preview.renderedCellCount, 200)
})

test('caps the number of converted Sheets before conversion', () => {
  const sheets = Array.from({ length: 25 }, (_, index) => ({
    name: `Sheet ${index + 1}`,
    rows: [[`值 ${index + 1}`]],
  }))

  const preview = workbookToPreview(createWorkbookBuffer(sheets))

  assert.equal(preview.originalSheetCount, 25)
  assert.equal(preview.sheets.length, 20)
  assert.equal(preview.sheetsTruncated, true)
})

test('caps total rectangular preview cells across Sheets', () => {
  const rows = Array.from({ length: 600 }, (_, rowIndex) => (
    Array.from({ length: 100 }, (_, columnIndex) => `${rowIndex}:${columnIndex}`)
  ))

  const preview = workbookToPreview(createWorkbookBuffer([
    { name: '第一表', rows },
    { name: '第二表', rows },
  ]))

  assert.equal(preview.renderedCellCount, 100_000)
  assert.equal(preview.totalCellsTruncated, true)
  assert.equal(preview.sheets[0]?.rows.length, 600)
  assert.equal(preview.sheets[1]?.rows.length, 400)
  assert.equal(preview.sheets[1]?.totalLimitTruncated, true)
})
