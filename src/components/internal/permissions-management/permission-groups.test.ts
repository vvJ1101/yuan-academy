import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectPermissionIdsByKeys,
  filterPermissionTree,
  getPermissionModuleKey,
  getRiskLevel,
  buildPermissionSummary,
  PERMISSION_TEMPLATES,
} from './permission-groups'
import type { MenuNode } from '@/types/role-management'

const tree: MenuNode[] = [
  {
    id: 'brand-root',
    parentId: null,
    name: '品牌资料',
    type: 1,
    permission: null,
    icon: null,
    sort: 1,
    path: null,
    children: [
      { id: 'brand-entry', parentId: 'brand-root', name: '品牌资料入口', type: 2, permission: 'menu.brand', icon: null, sort: 1, path: '/internal/brand' },
      { id: 'contact-page', parentId: 'brand-root', name: '品牌对接信息', type: 2, permission: 'menu.brand.contact', icon: null, sort: 2, path: '/internal/brand?type=contact' },
      { id: 'market-view', parentId: 'brand-root', name: '查看市场字段', type: 3, permission: 'brandContact.viewMarketFields', icon: null, sort: 3, path: null },
      { id: 'full-export', parentId: 'brand-root', name: '导出完整字段', type: 3, permission: 'brandContact.exportFullFields', icon: null, sort: 4, path: null },
    ],
  },
  {
    id: 'knowledge-root',
    parentId: null,
    name: '知识中心',
    type: 1,
    permission: null,
    icon: null,
    sort: 2,
    path: null,
    children: [
      { id: 'docs', parentId: 'knowledge-root', name: '我的上传', type: 2, permission: 'menu.documents', icon: null, sort: 1, path: '/internal/documents' },
    ],
  },
]

test('getPermissionModuleKey maps brand permissions to brand module', () => {
  assert.equal(getPermissionModuleKey(tree[0]), 'brand')
  assert.equal(getPermissionModuleKey(tree[1]), 'knowledge')
})

test('filterPermissionTree keeps parent path when matching child', () => {
  const result = filterPermissionTree(tree, '市场字段')
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'brand-root')
  assert.equal(result[0].children?.length, 1)
  assert.equal(result[0].children?.[0].id, 'market-view')
})

test('collectPermissionIdsByKeys resolves template permission ids', () => {
  const ids = collectPermissionIdsByKeys(tree, PERMISSION_TEMPLATES.marketing.keys)
  assert.deepEqual(ids.sort(), ['brand-entry', 'contact-page', 'market-view'].sort())
})

test('getRiskLevel marks delete and full export as high risk', () => {
  assert.equal(getRiskLevel('brandContact.exportFullFields'), 'high')
  assert.equal(getRiskLevel('brandOrdering.upload'), 'medium')
  assert.equal(getRiskLevel('brandContact.viewMarketFields'), 'none')
})

test('buildPermissionSummary explains checked permissions in business language', () => {
  const summary = buildPermissionSummary(tree, ['brand-entry', 'contact-page', 'market-view'])
  assert.ok(summary.includes('可进入品牌资料'))
  assert.ok(summary.includes('可查看品牌对接信息中的市场字段'))
})
