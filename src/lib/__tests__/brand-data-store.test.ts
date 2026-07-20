import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { getBrandTemplatePath, readBrandPayload, writeBrandPayload } from '../brand-data-store'

test('writes contact payload with metadata and backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-store-'))
  try {
    await writeFile(join(root, 'contact.json'), JSON.stringify([{ brandName: 'Old' }]))
    const payload = writeBrandPayload('contact', [{ brandName: 'New' }], '管理员', root)
    assert.equal(payload.items[0].brandName, 'New')
    assert.equal(payload.updatedBy, '管理员')
    assert.equal(existsSync(join(root, 'contact.backup.json')), true)

    const read = readBrandPayload('contact', root)
    assert.equal(read.items[0].brandName, 'New')
    assert.equal(read.updatedBy, '管理员')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('writes nested contact payload with metadata and backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-store-'))
  try {
    const contactDir = join(root, 'contact')
    await import('node:fs/promises').then(fs => fs.mkdir(contactDir, { recursive: true }))
    await writeFile(join(contactDir, 'data.json'), JSON.stringify([{ brandName: 'Old' }]))
    const payload = writeBrandPayload('contact', [{ brandName: 'New' }], '管理员', root)
    assert.equal(payload.items[0].brandName, 'New')
    assert.equal(existsSync(join(contactDir, 'data.backup.json')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('template path is inside requested private base dir', () => {
  assert.equal(getBrandTemplatePath('contact', '/safe/root'), '/safe/root/contact/template.xlsx')
})
