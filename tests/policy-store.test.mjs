import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  readPolicyPayload,
  writePolicies,
} from '../src/lib/policy-store.ts'

const fixtures = []

async function makeFixture(policies, metadata) {
  const root = await mkdtemp(join(tmpdir(), 'yuan-policy-'))
  fixtures.push(root)
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'policies.json'), JSON.stringify(policies), 'utf8')
  await writeFile(join(root, 'policies.updated.json'), JSON.stringify(metadata), 'utf8')
  return root
}

test.afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

test('readPolicyPayload reads private policies and metadata', async () => {
  const root = await makeFixture(
    [{ brand: 'SEAMEW' }],
    { updatedAt: '2026-07-16T00:00:00.000Z', updatedBy: '测试员' },
  )

  assert.deepEqual(readPolicyPayload(root), {
    policies: [{ brand: 'SEAMEW' }],
    updatedAt: '2026-07-16T00:00:00.000Z',
    updatedBy: '测试员',
  })
})

test('writePolicies creates metadata and preserves the previous version', async () => {
  const root = await makeFixture([{ brand: '旧品牌' }], {})

  writePolicies([{ brand: '新品牌' }], '管理员', root)

  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'policies.backup.json'), 'utf8')),
    [{ brand: '旧品牌' }],
  )
  assert.deepEqual(readPolicyPayload(root).policies, [{ brand: '新品牌' }])
  assert.equal(readPolicyPayload(root).updatedBy, '管理员')
})

test('readPolicyPayload rejects malformed policy data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yuan-policy-'))
  fixtures.push(root)
  await writeFile(join(root, 'policies.json'), '{}', 'utf8')

  assert.throws(() => readPolicyPayload(root), /订货政策数据格式错误/)
})
