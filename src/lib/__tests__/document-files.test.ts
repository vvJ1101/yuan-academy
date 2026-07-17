import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'

import {
  canDownloadPermission,
  getOriginalFilePath,
  getPreviewFilePath,
  validateUploadFile,
} from '../document-files'

const MB = 1024 * 1024
const MIME = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const

test('accepts each supported document extension with its matching MIME type', () => {
  for (const [fileType, mimeType] of Object.entries(MIME)) {
    const result = validateUploadFile({ name: `培训.${fileType}`, type: mimeType, size: 1024 })

    assert.equal(result.fileType, fileType)
    assert.equal(result.mimeType, mimeType)
    assert.equal(result.fileSize, 1024)
    assert.equal(result.originalFileName, `培训.${fileType}`)
  }
})

test('rejects executable and ZIP files from online processing', () => {
  assert.throws(
    () => validateUploadFile({ name: 'attack.exe', type: 'application/octet-stream', size: 10 }),
    /不支持/,
  )
  assert.throws(
    () => validateUploadFile({ name: 'archive.zip', type: 'application/zip', size: 10 }),
    /不支持/,
  )
})

test('rejects a supported extension when its MIME type does not match', () => {
  assert.throws(
    () => validateUploadFile({ name: '培训.pdf', type: MIME.docx, size: 10 }),
    /类型与扩展名不匹配/,
  )
})

test('accepts exactly 100 MB and rejects a larger file', () => {
  assert.equal(
    validateUploadFile({ name: '培训.pdf', type: MIME.pdf, size: 100 * MB }).fileSize,
    100 * MB,
  )
  assert.throws(
    () => validateUploadFile({ name: '培训.pdf', type: MIME.pdf, size: 100 * MB + 1 }),
    /100 MB/,
  )
})

test('normalizes extension case and strips directory components from displayed names', () => {
  const result = validateUploadFile({ name: '../../secret/培训.PPTX', type: MIME.pptx, size: 10 })

  assert.equal(result.originalFileName, '培训.PPTX')
  assert.equal(result.fileType, 'pptx')
})

test('constructs original and preview paths inside the private document directory', () => {
  assert.equal(
    getOriginalFilePath('doc-1', 'pptx'),
    join(process.cwd(), 'data', 'private', 'documents', 'doc-1', 'original.pptx'),
  )
  assert.equal(
    getPreviewFilePath('doc-1'),
    join(process.cwd(), 'data', 'private', 'documents', 'doc-1', 'preview.pdf'),
  )
})

test('rejects document IDs that could escape or alter the private storage path', () => {
  const unsafeDocumentIds = ['.', '..', '../outside', '/tmp/outside', 'folder\\outside', 'doc id']

  for (const docId of unsafeDocumentIds) {
    assert.throws(() => getOriginalFilePath(docId, 'pdf'), /文档 ID 无效/)
    assert.throws(() => getPreviewFilePath(docId), /文档 ID 无效/)
  }
})

test('allows downloads only for edit, delete, and admin permission levels', () => {
  assert.equal(canDownloadPermission(null), false)
  assert.equal(canDownloadPermission('view'), false)
  assert.equal(canDownloadPermission('edit'), true)
  assert.equal(canDownloadPermission('delete'), true)
  assert.equal(canDownloadPermission('admin'), true)
})
