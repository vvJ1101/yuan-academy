import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import { resolveDocumentPermission } from '../permissions/document-resolution'
import type { SessionUser } from '../auth'

const user = {
  id: 'user-1', email: 'editor@example.test', name: '编辑', role: 'staff',
  companyId: 'company-1', companyName: '公司', departmentId: 'dept-1', departmentName: '部门',
} as SessionUser

test('resolves selected document permission inputs in memory', () => {
  const base = { folderId: 'folder-1', ownerDeptId: null, overridePermissions: false, audiences: [], documentPermissions: [] }
  assert.equal(resolveDocumentPermission(user, base, 'edit'), 'edit')
  assert.equal(resolveDocumentPermission(user, { ...base, overridePermissions: true, documentPermissions: [{ companyId: null, departmentId: null, userId: 'user-1', role: null, permission: 'admin' }] }, 'view'), 'admin')
})

test('document list route does not query document permission once per item', async () => {
  const source = await readFile(join(process.cwd(), 'src', 'app', 'api', 'documents', 'route.ts'), 'utf8')
  assert.doesNotMatch(source, /getDocumentPermission/)
  assert.doesNotMatch(source, /Promise\.all\(docs\.map/)
  assert.match(source, /getFolderPermissionsForDocuments/)
})

test('replacement route keeps history JSON whole and returns Chinese history failure', async () => {
  const source = await readFile(join(process.cwd(), 'src', 'app', 'api', 'documents', '[id]', 'replace', 'route.ts'), 'utf8')
  assert.doesNotMatch(source, /JSON\.stringify\([\s\S]*?substring\(0,\s*100000\)/)
  assert.match(source, /创建替换前备份失败，原文件未变更/)
  assert.match(source, /deferReady:\s*true/)
  assert.match(source, /processingStatus:\s*'failed'/)
  assert.match(source, /getDocumentProcessorErrorMessage\(error\)/)
  assert.doesNotMatch(source, /系统已保留或恢复可用的原文件状态/)
})
