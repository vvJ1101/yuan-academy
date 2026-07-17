import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { calculateDocumentStorage, createDocumentHistorySnapshot, finalizeDocumentReplacement, processDocumentFile } from '../document-processor'
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

test('storage totals every original when a document directory contains multiple originals', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const dir = join(root, 'multi'); await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'original.pdf'), Buffer.alloc(11))
  await writeFile(join(dir, 'original.pptx'), Buffer.alloc(13))
  await writeFile(join(dir, 'preview.pdf'), Buffer.alloc(100))
  assert.equal((await calculateDocumentStorage(root)).usedBytes, 24)
})

test('replacement processing can defer ready until content is committed', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const changes: Record<string, unknown>[] = []
  const result = await processDocumentFile({ documentId: 'deferred', buffer: Buffer.from('pdf!'), upload: upload('pdf') }, {
    root, deferReady: true, updateMetadata: async changeset => { changes.push(changeset) },
  })
  assert.equal(result.status, 'ready')
  assert.equal(changes.at(-1)?.processingStatus, 'processing')
})

test('history snapshot remains complete valid JSON for content larger than 100k', () => {
  const document = { title: '培训', content: 'a'.repeat(120_000), fullContent: 'b', condensedContent: 'c', displayMode: 'full' }
  assert.deepEqual(JSON.parse(createDocumentHistorySnapshot(document)), document)
})

test('replacement finalization marks failed when parsing or final update fails', async () => {
  for (const failure of ['parse', 'commit'] as const) {
    let failed = false
    await assert.rejects(finalizeDocumentReplacement({
      prepare: async () => {
        if (failure === 'parse') throw new Error('parse failed')
        return { fullContent: 'new' }
      },
      commit: async () => {
        if (failure === 'commit') throw new Error('update failed')
      },
      markFailed: async () => { failed = true },
    }))
    assert.equal(failed, true)
  }
})

test('replacement restores old original and preview when first metadata transition fails', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const dir = join(root, 'rollback'); await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'original.pdf'), 'old-original')
  await writeFile(join(dir, 'preview.pdf'), 'old-preview')
  let metadataCalls = 0
  await assert.rejects(processDocumentFile({ documentId: 'rollback', buffer: Buffer.from('new-original'), upload: upload('pdf') }, {
    root,
    replacement: true,
    updateMetadata: async () => { metadataCalls += 1; throw new Error('database unavailable') },
  }))
  assert.equal(metadataCalls, 1)
  assert.equal((await readFile(join(dir, 'original.pdf'))).toString(), 'old-original')
  assert.equal((await readFile(join(dir, 'preview.pdf'))).toString(), 'old-preview')
  assert.deepEqual((await readdir(dir)).filter(file => file.includes('.backup') || file.includes('.staging')), [])
})

test('replacement write or rename failure preserves old ready files and does not update metadata', async (t) => {
  const root = await tempRoot(); t.after(() => rm(root, { recursive: true, force: true }))
  const dir = join(root, 'swap-fail'); await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'original.pdf'), 'old-original')
  await writeFile(join(dir, 'preview.pdf'), 'old-preview')
  let metadataCalls = 0
  const result = await processDocumentFile({ documentId: 'swap-fail', buffer: Buffer.from('new-original'), upload: upload('pdf') }, {
    root,
    replacement: true,
    renameFile: async (source, destination) => {
      if (source.endsWith('.staging')) throw new Error('rename failed')
      await rename(source, destination)
    },
    updateMetadata: async () => { metadataCalls += 1 },
  })
  assert.equal(result.originalStored, false)
  assert.equal(metadataCalls, 0)
  assert.equal((await readFile(join(dir, 'original.pdf'))).toString(), 'old-original')
  assert.equal((await readFile(join(dir, 'preview.pdf'))).toString(), 'old-preview')
  assert.deepEqual((await readdir(dir)).filter(file => file.includes('.backup') || file.includes('.staging')), [])
})
