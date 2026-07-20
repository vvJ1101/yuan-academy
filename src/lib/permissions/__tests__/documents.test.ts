import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDocumentVisibilityWhere } from '../documents'
import type { SessionUser } from '../../auth'

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    role: 'viewer',
    companyId: null,
    departmentId: '',
    ...overrides,
  }
}

test('超级管理员不受文档可见范围限制', () => {
  assert.deepEqual(
    buildDocumentVisibilityWhere(user({ role: 'super_admin' }), ['folder-1']),
    {},
  )
})

test('显式文件夹权限允许无部门用户查看文件夹文档', () => {
  assert.deepEqual(
    buildDocumentVisibilityWhere(user(), ['folder-1', 'folder-2']),
    { folderId: { in: ['folder-1', 'folder-2'] } },
  )
})

test('部门用户可以查看本部门拥有或作为受众的文档', () => {
  assert.deepEqual(
    buildDocumentVisibilityWhere(user({ departmentId: 'department-1' }), []),
    {
      OR: [
        { ownerDeptId: 'department-1' },
        { audiences: { some: { departmentId: 'department-1' } } },
      ],
    },
  )
})

test('部门与文件夹权限合并为任一条件可见', () => {
  assert.deepEqual(
    buildDocumentVisibilityWhere(
      user({ departmentId: 'department-1' }),
      ['folder-1'],
    ),
    {
      OR: [
        { ownerDeptId: 'department-1' },
        { audiences: { some: { departmentId: 'department-1' } } },
        { folderId: { in: ['folder-1'] } },
      ],
    },
  )
})

test('没有任何权限时返回永不匹配条件', () => {
  assert.deepEqual(
    buildDocumentVisibilityWhere(user(), []),
    { id: '__no_access__' },
  )
})
