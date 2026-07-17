import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { calculateDocumentStorage, processDocumentFile } from '../document-processor'
import type { ValidatedUpload } from '../document-files'

function upload(fileType: ValidatedUpload['fileType'], name = `training.${fileType}`): ValidatedUpload {
  return {
    originalFileName: name,
    fileType,
    mimeType: fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    fileSize: 4,
  }
}

async function tempRoot() {
  return mkdtemp(join(tmpdir(), 'document-processor-'))
}

test('stores a PDF original and marks its own preview ready without conversion', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const changes: Record<string, unknown>[] = []
  const result = await processDocumentFile({ documentId: 'doc-pdf', buffer: Buffer.from('pdf!'), upload: upload('pdf') }, {
    root,
    updateMetadata: async changeset => { changes.push(changeset) },
  })
  assert.deepEqual(result, { status: 'ready', hasPreview: true })
  assert.equal((await readFile(join(root, 'doc-pdf', 'original.pdf'))).toString(), 'pdf!')
  assert.equal((await readFile(join(root, 'doc-pdf', 'preview.pdf'))).toString(), 'pdf!')
  assert.equal(changes.at(-1)?.processingStatus, 'ready')
  assert.equal(changes.at(-1)?.previewPath, 'preview.pdf')
})

test('stores PPTX and records successful generated preview', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const calls: unknown[][] = []
  const result = await processDocumentFile({ documentId: 'doc-pptx', buffer: Buffer.from('pptx'), upload: upload('pptx') }, {
    root,
    convertPpt: async (...args) => {
      calls.push(args)
      await writeFile(join(root, 'doc-pptx', 'preview.pdf'), 'preview')
      return { success: true }
    },
    updateMetadata: async () => undefined,
  })
  assert.equal(calls[0]?.[1], 'pptx')
  assert.deepEqual(result, { status: 'ready', hasPreview: true })
})

test('retains the .ppt extension for legacy PowerPoint conversion', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  let extension = ''
  await processDocumentFile({ documentId: 'doc-ppt', buffer: Buffer.from('ppt!'), upload: upload('ppt') }, {
    root,
    convertPpt: async (_buffer, ext, _id, dir) => {
      extension = ext
      await writeFile(join(dir, 'preview.pdf'), 'preview')
      return { success: true }
    },
    updateMetadata: async () => undefined,
  })
  assert.equal(extension, 'ppt')
  assert.equal((await readFile(join(root, 'doc-ppt', 'original.ppt'))).toString(), 'ppt!')
})

test('keeps original and marks processing failed when LibreOffice is unavailable', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const changes: Record<string, unknown>[] = []
  const result = await processDocumentFile({ documentId: 'doc-fail', buffer: Buffer.from('pptx'), upload: upload('pptx') }, {
    root,
    convertPpt: async () => ({ success: false, error: 'LibreOffice 未安装 /secret/path' }),
    updateMetadata: async changeset => { changes.push(changeset) },
  })
  assert.equal(result.status, 'failed')
  assert.equal((await readFile(join(root, 'doc-fail', 'original.pptx'))).toString(), 'pptx')
  assert.equal(changes.at(-1)?.processingStatus, 'failed')
  assert.doesNotMatch(String(changes.at(-1)?.processingError), /secret/)
})

test('reports original write failure without pretending the original was retained', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'blocked'), 'not a directory')
  const changes: Record<string, unknown>[] = []
  const result = await processDocumentFile({ documentId: 'blocked', buffer: Buffer.from('pdf!'), upload: upload('pdf') }, {
    root,
    updateMetadata: async changeset => { changes.push(changeset) },
  })
  assert.equal(result.status, 'failed')
  assert.equal(result.originalStored, false)
  assert.equal(changes.at(-1)?.processingStatus, 'failed')
})

test('rejects document IDs that could escape the private root', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  await assert.rejects(
    processDocumentFile({ documentId: '../escape', buffer: Buffer.from('pdf!'), upload: upload('pdf') }, {
      root, updateMetadata: async () => undefined,
    }),
    /文档 ID 无效/,
  )
})

test('storage totals include only original DOCX/PDF/PPTX/XLSX files', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  for (const [id, ext, bytes] of [['a', 'docx', 2], ['b', 'pdf', 3], ['c', 'pptx', 5], ['d', 'xlsx', 7]] as const) {
    const dir = join(root, id); await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `original.${ext}`), Buffer.alloc(bytes))
    await writeFile(join(dir, 'preview.pdf'), Buffer.alloc(100))
  }
  assert.deepEqual(await calculateDocumentStorage(root), {
    usedBytes: 17,
    usedGB: 0,
    totalGB: 100,
    percent: 0,
  })
})
