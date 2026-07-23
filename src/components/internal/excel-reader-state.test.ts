import assert from 'node:assert/strict'
import test from 'node:test'

import { createRequestGuard, getSafeWorkbookDownloadName } from './excel-reader-state'

test('canceling an old request generation does not deactivate the new generation', () => {
  const oldGeneration = createRequestGuard()
  const newGeneration = createRequestGuard()

  oldGeneration.cancel()

  assert.equal(oldGeneration.isActive(), false)
  assert.equal(newGeneration.isActive(), true)
})

test('preserves the actual XLS or XLSX extension in safe download names', () => {
  assert.equal(getSafeWorkbookDownloadName('季度预算', 'xlsx'), '季度预算.xlsx')
  assert.equal(getSafeWorkbookDownloadName('旧版报表.xlsx', 'xls'), '旧版报表.xls')
})

test('removes path and CRLF characters from workbook download names', () => {
  const name = getSafeWorkbookDownloadName('../财务\\报表\r\nContent-Type: text/html', 'xlsx')

  assert.equal(name, '财务-报表-Content-Type- text-html.xlsx')
  assert.doesNotMatch(name, /[\\/\r\n]/)
})
