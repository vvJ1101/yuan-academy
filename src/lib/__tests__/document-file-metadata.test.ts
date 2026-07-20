import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { resolveStoredDocumentFileMeta } from '../document-files'

test('recovers legacy document metadata from legacy public uploads when database has docx zero defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yuan-doc-meta-'))
  try {
    const legacyDir = join(root, 'public', 'uploads', 'documents', 'doc-legacy')
    await writeFile(join(legacyDir, 'original.pptx'), Buffer.alloc(124770), { flag: 'wx' }).catch(async error => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        await import('node:fs/promises').then(fs => fs.mkdir(legacyDir, { recursive: true }))
        await writeFile(join(legacyDir, 'original.pptx'), Buffer.alloc(124770), { flag: 'wx' })
        return
      }
      throw error
    })

    const meta = await resolveStoredDocumentFileMeta({
      docId: 'doc-legacy',
      fileType: 'docx',
      fileSize: 0,
      originalFileName: '',
      root,
    })

    assert.equal(meta.fileType, 'pptx')
    assert.equal(meta.fileSize, 124770)
    assert.equal(meta.originalFileName, 'original.pptx')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('keeps trustworthy database metadata without disk probing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yuan-doc-meta-'))
  try {
    const meta = await resolveStoredDocumentFileMeta({
      docId: 'doc-current',
      fileType: 'pdf',
      fileSize: 2048,
      originalFileName: '培训.pdf',
      root,
    })

    assert.equal(meta.fileType, 'pdf')
    assert.equal(meta.fileSize, 2048)
    assert.equal(meta.originalFileName, '培训.pdf')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
