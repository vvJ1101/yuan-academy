import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFileResponseHeaders,
  parseByteRange,
  resolveDocumentFileAccess,
} from '../document-file-access'

test('returns null when no Range header is present', () => {
  assert.equal(parseByteRange(null, 5000), null)
})

test('parses an explicit byte range', () => {
  assert.deepEqual(parseByteRange('bytes=0-999', 5000), { start: 0, end: 999 })
})

test('parses a suffix byte range', () => {
  assert.deepEqual(parseByteRange('bytes=-500', 5000), { start: 4500, end: 4999 })
})

test('rejects invalid, unsatisfiable, and multi-range requests', () => {
  for (const value of ['items=0-10', 'bytes=5000-', 'bytes=5-4', 'bytes=0-1,3-4']) {
    assert.throws(() => parseByteRange(value, 5000), /范围无效/)
  }
})

test('allows a viewer to open a protected preview', () => {
  assert.deepEqual(
    resolveDocumentFileAccess({ permission: 'view', variant: 'preview', fileType: 'pdf', fileExists: true }),
    { allowed: true, source: 'preview' },
  )
})

test('denies original downloads to viewers and allows editors', () => {
  assert.equal(resolveDocumentFileAccess({ permission: 'view', variant: 'original' }).allowed, false)
  assert.deepEqual(
    resolveDocumentFileAccess({ permission: 'edit', variant: 'original', fileType: 'pdf', fileExists: true }),
    { allowed: true, source: 'original' },
  )
})

test('requires edit permission for print even when requesting a preview', () => {
  assert.equal(resolveDocumentFileAccess({ permission: 'view', variant: 'preview', purpose: 'print', fileType: 'pdf', fileExists: true }).allowed, false)
  assert.equal(resolveDocumentFileAccess({ permission: 'edit', variant: 'preview', purpose: 'print', fileType: 'pdf', fileExists: true }).allowed, true)
})

test('streams an Excel workbook itself for inline preview without granting download access', () => {
  assert.deepEqual(
    resolveDocumentFileAccess({ permission: 'view', variant: 'preview', fileType: 'xlsx', fileExists: true }),
    { allowed: true, source: 'original' },
  )
  assert.equal(resolveDocumentFileAccess({ permission: 'view', variant: 'original', fileType: 'xlsx', fileExists: true }).allowed, false)
  assert.equal(resolveDocumentFileAccess({ permission: 'view', variant: 'preview', disposition: 'attachment', fileType: 'xlsx', fileExists: true }).allowed, false)
})

test('reports a missing selected file and rejects unknown variants', () => {
  assert.deepEqual(
    resolveDocumentFileAccess({ permission: 'view', variant: 'preview', fileType: 'pdf', fileExists: false }),
    { allowed: false, status: 404, error: '文件不存在' },
  )
  assert.deepEqual(
    resolveDocumentFileAccess({ permission: 'admin', variant: 'thumbnail', fileType: 'pdf', fileExists: true }),
    { allowed: false, status: 400, error: '文件版本无效' },
  )
})

test('builds private full and partial response headers with validated MIME', () => {
  assert.deepEqual(buildFileResponseHeaders({ mimeType: 'text/html', fileName: '培训.pdf', disposition: 'inline', size: 5000 }), {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': "inline; filename*=UTF-8''%E5%9F%B9%E8%AE%AD.pdf",
    'Content-Length': '5000',
    'Content-Type': 'application/octet-stream',
  })
  assert.equal(buildFileResponseHeaders({ mimeType: 'application/pdf', fileName: '培训.pdf', disposition: 'inline', size: 5000, range: { start: 0, end: 999 } })['Content-Range'], 'bytes 0-999/5000')
})
