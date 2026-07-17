import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { migrateLegacyFiles } from '../../../scripts/migrate-document-files-private'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'document-migration-'))
  const publicRoot = join(root, 'public'); const privateRoot = join(root, 'private')
  const dir = join(publicRoot, 'doc-1'); await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'original.pdf'), 'original')
  await writeFile(join(dir, 'output.pdf'), 'preview')
  await writeFile(join(dir, 'image-1.png'), 'asset')
  return { root, publicRoot, privateRoot, dir }
}

test('verified removal deletes only migrated files and retains auxiliary assets', async (t) => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }))
  let metadata: Record<string, unknown> = {}
  const summary = await migrateLegacyFiles({
    publicRoot: f.publicRoot, privateRoot: f.privateRoot, apply: true, removePublicAfterVerify: true,
    database: {
      findDocument: async () => ({ id: 'doc-1', originalFileName: '培训课件.pdf' }),
      updateDocument: async (_id, data) => { metadata = data },
    },
  })
  assert.equal(summary.failures, 0)
  assert.equal((await readFile(join(f.dir, 'image-1.png'))).toString(), 'asset')
  await assert.rejects(access(join(f.dir, 'original.pdf')))
  await assert.rejects(access(join(f.dir, 'output.pdf')))
  assert.equal(metadata.originalFileName, '培训课件.pdf')
})

test('dry-run performs DB, source checksum, and destination conflict validation without writes', async (t) => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }))
  await mkdir(join(f.privateRoot, 'doc-1'), { recursive: true })
  await writeFile(join(f.privateRoot, 'doc-1', 'original.pdf'), 'different')
  let dbReads = 0; let checksumReads = 0; let dbWrites = 0
  const summary = await migrateLegacyFiles({
    publicRoot: f.publicRoot, privateRoot: f.privateRoot,
    database: {
      findDocument: async () => { dbReads += 1; return { id: 'doc-1', originalFileName: '' } },
      updateDocument: async () => { dbWrites += 1 },
    },
    checksumFile: async path => { checksumReads += 1; return (await readFile(path)).toString() },
  })
  assert.equal(dbReads, 1)
  assert.ok(checksumReads >= 2)
  assert.equal(dbWrites, 0)
  assert.equal(summary.failures, 1)
})

test('dry-run reports missing DB record and unreadable/checksum failure', async (t) => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }))
  const missing = await migrateLegacyFiles({
    publicRoot: f.publicRoot, privateRoot: f.privateRoot,
    database: { findDocument: async () => null, updateDocument: async () => undefined },
  })
  assert.equal(missing.failures, 1)

  const unreadable = await migrateLegacyFiles({
    publicRoot: f.publicRoot, privateRoot: f.privateRoot,
    database: { findDocument: async () => ({ id: 'doc-1', originalFileName: '' }), updateDocument: async () => undefined },
    checksumFile: async () => { throw new Error('read failed') },
  })
  assert.equal(unreadable.failures, 1)
})

test('apply refuses metadata update when copied destination checksum mismatches', async (t) => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }))
  let dbWrites = 0
  const summary = await migrateLegacyFiles({
    publicRoot: f.publicRoot, privateRoot: f.privateRoot, apply: true,
    database: {
      findDocument: async () => ({ id: 'doc-1', originalFileName: '原名.pdf' }),
      updateDocument: async () => { dbWrites += 1 },
    },
    checksumFile: async path => path.startsWith(f.privateRoot) ? 'destination-mismatch' : 'source-checksum',
  })
  assert.equal(summary.failures, 1)
  assert.equal(dbWrites, 0)
})
