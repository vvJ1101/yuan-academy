# Permission Management Hierarchical UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the role permission configuration page easier to use by grouping permissions by business module, adding search, templates, risk tags, and a human-readable selected-permission summary.

**Architecture:** Keep the existing `SysMenu / SysRoleMenu / SysRole.dataScope` backend and existing role APIs. Refactor only the client-side permission management UI into small focused helpers/components under `src/components/internal/permissions-management/`. The saved payload remains the same selected menu IDs and data scope values.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Ant Design, Node test runner.

## Global Constraints

- Strictly follow project MD documents; any deviation from documented deployment or implementation requirements must be confirmed before execution.
- Do not modify `src/lib/parser.ts`, `src/lib/prompts/*.ts`, `scripts/fts-migrate.ts`, or `src/types/dashboard.ts`.
- Do not change database schema or add dependencies.
- Preserve existing API contracts for role permissions and data scope.
- Frontend must handle loading, success, and error states.
- Dangerous permissions must be visually marked and require confirmation before save.

---

## File Structure

- Create: `src/components/internal/permissions-management/permission-groups.ts`
  - Pure helpers for module grouping, search, risk classification, templates, and summaries.
- Create: `src/components/internal/permissions-management/permission-groups.test.ts`
  - Tests for grouping/search/templates/risk/summary helpers.
- Modify: `src/components/internal/permissions-management/index.tsx`
  - Replace the dense single tree with module tabs/segmented navigation, filtered tree panel, template buttons, and selected summary.
- Update: `docs/superpowers/plans/2026-07-20-permission-management-hierarchical-ui.md`
  - Mark implementation progress if needed.

---

### Task 1: Add Pure Permission Group Helpers

**Files:**
- Create: `src/components/internal/permissions-management/permission-groups.ts`
- Create: `src/components/internal/permissions-management/permission-groups.test.ts`

**Interfaces:**
- Consumes: existing `MenuNode` type from `src/types/role-management`.
- Produces:
  - `PERMISSION_MODULES`
  - `PERMISSION_TEMPLATES`
  - `getPermissionModuleKey(node: MenuNode): PermissionModuleKey`
  - `filterPermissionTree(nodes: MenuNode[], query: string): MenuNode[]`
  - `collectPermissionIdsByKeys(nodes: MenuNode[], keys: string[]): string[]`
  - `getRiskLevel(permission?: string): 'none' | 'medium' | 'high'`
  - `buildPermissionSummary(nodes: MenuNode[], checkedIds: string[]): string[]`

- [ ] **Step 1: Create tests for grouping/search/templates**

Create `src/components/internal/permissions-management/permission-groups.test.ts`:

```ts
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
    name: '品牌资料',
    type: 1,
    permission: '',
    children: [
      { id: 'brand-entry', name: '品牌资料入口', type: 2, permission: 'menu.brand' },
      { id: 'contact-page', name: '品牌对接信息', type: 2, permission: 'menu.brand.contact' },
      { id: 'market-view', name: '查看市场字段', type: 3, permission: 'brandContact.viewMarketFields' },
      { id: 'full-export', name: '导出完整字段', type: 3, permission: 'brandContact.exportFullFields' },
    ],
  },
  {
    id: 'knowledge-root',
    name: '知识中心',
    type: 1,
    permission: '',
    children: [
      { id: 'docs', name: '我的上传', type: 2, permission: 'menu.documents' },
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
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","jsx":"react-jsx"}' node --require ts-node/register --test src/components/internal/permissions-management/permission-groups.test.ts
```

Expected: FAIL because `permission-groups.ts` does not exist.

- [ ] **Step 3: Implement helper file**

Create `src/components/internal/permissions-management/permission-groups.ts` with:

```ts
import type { MenuNode } from '@/types/role-management'

export type PermissionModuleKey = 'knowledge' | 'brand' | 'smartApps' | 'admin' | 'other'

export const PERMISSION_MODULES: Array<{ key: PermissionModuleKey; label: string; description: string }> = [
  { key: 'knowledge', label: '知识中心', description: '文档、文件夹、SOP、收藏' },
  { key: 'brand', label: '品牌资料', description: '订货政策、品牌对接信息' },
  { key: 'smartApps', label: '智能应用', description: 'AI、搜索、FAQ' },
  { key: 'admin', label: '系统管理', description: '用户、角色、组织、审计、设置' },
  { key: 'other', label: '其他', description: '未归类权限' },
]

export const PERMISSION_TEMPLATES = {
  marketing: {
    label: '市场部模板',
    description: '品牌对接市场字段 + 订货政策查看',
    keys: ['menu.brand', 'menu.brand.contact', 'brandContact.viewMarketFields', 'menu.brand.ordering', 'brandOrdering.view'],
  },
  product: {
    label: '商品部模板',
    description: '品牌对接完整维护 + 订货政策查看',
    keys: [
      'menu.brand',
      'menu.brand.contact',
      'brandContact.viewFullFields',
      'brandContact.edit',
      'brandContact.upload',
      'brandContact.exportFullFields',
      'menu.brand.ordering',
      'brandOrdering.view',
    ],
  },
  brand: {
    label: '品牌部模板',
    description: '订货政策维护 + 品牌资料查看',
    keys: [
      'menu.brand',
      'menu.brand.ordering',
      'brandOrdering.view',
      'brandOrdering.edit',
      'brandOrdering.upload',
      'brandOrdering.parse',
      'brandOrdering.export',
    ],
  },
  readonly: {
    label: '只读模板',
    description: '基础页面查看 + 收藏 + 搜索',
    keys: [
      'menu.dashboard',
      'menu.documents',
      'menu.recent',
      'menu.favorites',
      'menu.search',
      'favorite.create',
      'favorite.delete',
    ],
  },
} as const

const MODULE_MATCHERS: Record<PermissionModuleKey, string[]> = {
  knowledge: ['menu.documents', 'document.', 'folder.', 'favorite.', 'menu.sop', 'menu.recent', 'menu.favorites', 'menu.policy', 'menu.policyUpload'],
  brand: ['menu.brand', 'brandOrdering.', 'brandContact.'],
  smartApps: ['menu.ai', 'ai.', 'menu.search', 'menu.faq', 'faq.'],
  admin: ['menu.admin', 'user.', 'org.', 'role.', 'analytics.', 'audit.', 'settings.', 'learningPath.', 'account.'],
  other: [],
}

function nodeText(node: MenuNode): string {
  return `${node.name || ''} ${node.permission || ''}`.toLowerCase()
}

function flatten(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])])
}

export function getPermissionModuleKey(node: MenuNode): PermissionModuleKey {
  const text = `${node.name || ''} ${node.permission || ''}`
  for (const module of PERMISSION_MODULES) {
    if (module.key === 'other') continue
    if (MODULE_MATCHERS[module.key].some(prefix => text.includes(prefix))) return module.key
    if (module.key === 'brand' && text.includes('品牌')) return 'brand'
    if (module.key === 'knowledge' && (text.includes('知识') || text.includes('文档') || text.includes('SOP'))) return 'knowledge'
    if (module.key === 'smartApps' && (text.includes('AI') || text.includes('FAQ') || text.includes('搜索'))) return 'smartApps'
    if (module.key === 'admin' && (text.includes('管理') || text.includes('用户') || text.includes('角色'))) return 'admin'
  }
  return 'other'
}

export function filterPermissionTree(nodes: MenuNode[], query: string): MenuNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const visit = (node: MenuNode): MenuNode | null => {
    const children = (node.children || []).map(visit).filter((child): child is MenuNode => Boolean(child))
    if (nodeText(node).includes(q) || children.length > 0) {
      return { ...node, children }
    }
    return null
  }
  return nodes.map(visit).filter((node): node is MenuNode => Boolean(node))
}

export function collectPermissionIdsByKeys(nodes: MenuNode[], keys: readonly string[]): string[] {
  const wanted = new Set(keys)
  return flatten(nodes)
    .filter(node => node.permission && wanted.has(node.permission))
    .map(node => node.id)
}

export function getRiskLevel(permission?: string): 'none' | 'medium' | 'high' {
  if (!permission) return 'none'
  if (
    permission.includes('delete') ||
    permission.includes('deleteAll') ||
    permission.includes('viewFullFields') ||
    permission.includes('exportFullFields') ||
    permission === 'settings.manage' ||
    permission === 'role.assignPermission' ||
    permission === 'role.assignDataScope'
  ) return 'high'
  if (
    permission.includes('upload') ||
    permission.includes('replace') ||
    permission.includes('edit') ||
    permission.includes('export') ||
    permission.includes('create')
  ) return 'medium'
  return 'none'
}

export function buildPermissionSummary(nodes: MenuNode[], checkedIds: string[]): string[] {
  const checked = new Set(checkedIds)
  const checkedNodes = flatten(nodes).filter(node => checked.has(node.id))
  const permissions = new Set(checkedNodes.map(node => node.permission).filter(Boolean))
  const summary: string[] = []

  if (permissions.has('menu.brand')) summary.push('可进入品牌资料')
  if (permissions.has('menu.brand.ordering') || permissions.has('brandOrdering.view')) summary.push('可查看订货政策')
  if (permissions.has('menu.brand.contact')) summary.push('可进入品牌对接信息')
  if (permissions.has('brandContact.viewMarketFields')) summary.push('可查看品牌对接信息中的市场字段')
  if (permissions.has('brandContact.viewFullFields')) summary.push('可查看品牌对接信息完整字段')
  if (permissions.has('brandContact.edit')) summary.push('可网页编辑品牌对接信息')
  if (permissions.has('brandContact.upload')) summary.push('可上传更新品牌对接信息')
  if (permissions.has('brandOrdering.edit')) summary.push('可编辑订货政策')
  if (permissions.has('brandOrdering.upload')) summary.push('可上传订货政策')

  const highRisk = checkedNodes.filter(node => getRiskLevel(node.permission) === 'high')
  if (highRisk.length > 0) summary.push(`包含 ${highRisk.length} 个高危权限，请保存前复核`)
  if (summary.length === 0) summary.push('暂未选择可识别的业务权限')
  return summary
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","jsx":"react-jsx"}' node --require ts-node/register --test src/components/internal/permissions-management/permission-groups.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/internal/permissions-management/permission-groups.ts src/components/internal/permissions-management/permission-groups.test.ts
git commit -m "test: add permission grouping helpers"
```

---

### Task 2: Refactor Permission Modal UI

**Files:**
- Modify: `src/components/internal/permissions-management/index.tsx`

**Interfaces:**
- Consumes:
  - `PERMISSION_MODULES`
  - `PERMISSION_TEMPLATES`
  - `filterPermissionTree`
  - `collectPermissionIdsByKeys`
  - `getRiskLevel`
  - `buildPermissionSummary`
- Produces: A role config modal that supports module switching, search, templates, risk tags, and selected summary without changing API payloads.

- [ ] **Step 1: Add imports**

In `src/components/internal/permissions-management/index.tsx`, import:

```ts
import {
  PERMISSION_MODULES,
  PERMISSION_TEMPLATES,
  buildPermissionSummary,
  collectPermissionIdsByKeys,
  filterPermissionTree,
  getPermissionModuleKey,
  getRiskLevel,
  type PermissionModuleKey,
} from './permission-groups'
```

- [ ] **Step 2: Add UI state**

Add state near permission modal state:

```ts
const [activePermissionModule, setActivePermissionModule] = useState<PermissionModuleKey>('brand')
const [permissionSearch, setPermissionSearch] = useState('')
```

- [ ] **Step 3: Add computed grouped tree and summary**

Add `useMemo` blocks in the component:

```ts
const rawPermMenus = useMemo(() => {
  function unwrap(nodes: DataNode[]): MenuNode[] {
    return nodes.map(node => ({
      id: String(node.key),
      name: typeof node.title === 'string' ? node.title : String(node.key),
      type: 1,
      permission: '',
      children: node.children ? unwrap(node.children) : undefined,
    }))
  }
  return unwrap(permTree)
}, [permTree])
```

If preserving original `MenuNode` data is cleaner during implementation, store it separately as `permMenuTree: MenuNode[]` when loading `permissionApi.getTree()`. Prefer this cleaner approach:

```ts
const [permMenuTree, setPermMenuTree] = useState<MenuNode[]>([])
```

Then set it wherever `setPermTree(toTreeNodes(treeRes.data))` exists:

```ts
setPermMenuTree(treeRes.data)
setPermTree(toTreeNodes(treeRes.data))
```

Compute:

```ts
const visiblePermissionMenus = useMemo(() => {
  const moduleNodes = permMenuTree.filter(node => getPermissionModuleKey(node) === activePermissionModule)
  return filterPermissionTree(moduleNodes.length > 0 ? moduleNodes : permMenuTree, permissionSearch)
}, [activePermissionModule, permMenuTree, permissionSearch])

const visiblePermissionTree = useMemo(() => toTreeNodes(visiblePermissionMenus), [visiblePermissionMenus])

const selectedSummary = useMemo(() => buildPermissionSummary(permMenuTree, permChecked), [permMenuTree, permChecked])

const selectedHighRiskCount = useMemo(() => {
  const ids = new Set(permChecked)
  function count(nodes: MenuNode[]): number {
    return nodes.reduce((total, node) => {
      const self = ids.has(node.id) && getRiskLevel(node.permission) === 'high' ? 1 : 0
      return total + self + count(node.children || [])
    }, 0)
  }
  return count(permMenuTree)
}, [permChecked, permMenuTree])
```

- [ ] **Step 4: Replace permission tab content**

In the unified config modal's permission tab, replace the single dense tree with:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_260px] gap-4">
  <div className="space-y-2">
    {PERMISSION_MODULES.map(module => (
      <button
        key={module.key}
        type="button"
        onClick={() => setActivePermissionModule(module.key)}
        className={`w-full min-h-[44px] text-left rounded-lg border px-3 py-2 ${activePermissionModule === module.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-neutral-200 bg-white text-neutral-700'}`}
      >
        <div className="text-sm font-medium">{module.label}</div>
        <div className="text-xs text-neutral-400">{module.description}</div>
      </button>
    ))}
  </div>

  <div className="rounded-xl border border-neutral-200 bg-white p-4">
    <Input.Search
      placeholder="搜索权限，例如：品牌对接、市场字段、删除"
      value={permissionSearch}
      onChange={event => setPermissionSearch(event.target.value)}
      allowClear
      style={{ marginBottom: 12 }}
    />
    <Space wrap style={{ marginBottom: 12 }}>
      {Object.entries(PERMISSION_TEMPLATES).map(([key, template]) => (
        <Button
          key={key}
          size="small"
          onClick={() => {
            const ids = collectPermissionIdsByKeys(permMenuTree, template.keys)
            setPermChecked(Array.from(new Set([...permChecked, ...ids])))
            message.success(`已应用${template.label}`)
          }}
        >
          {template.label}
        </Button>
      ))}
    </Space>
    <Tree
      checkable
      checkedKeys={permChecked}
      onCheck={(keys) => setPermChecked(keys as string[])}
      treeData={visiblePermissionTree}
      defaultExpandAll={permExpandAll}
    />
  </div>

  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
    <div className="text-sm font-semibold text-neutral-900 mb-2">已选权限摘要</div>
    <div className="space-y-2">
      {selectedSummary.map(item => (
        <div key={item} className="text-xs text-neutral-700">{item}</div>
      ))}
    </div>
    {selectedHighRiskCount > 0 && (
      <Alert
        style={{ marginTop: 12 }}
        type="warning"
        showIcon
        message={`包含 ${selectedHighRiskCount} 个高危权限`}
      />
    )}
  </div>
</div>
```

- [ ] **Step 5: Add high-risk save confirmation**

Before saving permissions in `handleSaveConfig`, add:

```ts
if (selectedHighRiskCount > 0 && !window.confirm(`当前角色包含 ${selectedHighRiskCount} 个高危权限，确定保存？`)) {
  setConfigSaving(false)
  return
}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/internal/permissions-management/index.tsx
git commit -m "feat: organize role permissions by module"
```

---

### Task 3: Update Documentation and Verify PR Safety

**Files:**
- Modify: `docs/PERMISSION_MATRIX.md`
- Modify: `docs/superpowers/plans/2026-07-20-permission-management-hierarchical-ui.md`

**Interfaces:**
- Consumes: implemented UI behavior.
- Produces: documentation for administrators and deployment reviewers.

- [ ] **Step 1: Update permission matrix note**

Add a short “权限管理 UI 使用建议” section to `docs/PERMISSION_MATRIX.md`:

```md
## 权限管理 UI 使用建议

- 优先按模块找权限：知识中心、品牌资料、智能应用、系统管理。
- 市场部建议使用“市场部模板”，只包含品牌对接市场字段和订货政策查看。
- 商品部建议使用“商品部模板”，包含品牌对接完整维护权限。
- 保存前如果出现高危权限提示，需要复核是否真的需要删除、完整导出、系统设置或角色分配权限。
```

- [ ] **Step 2: Run final checks**

Run:

```bash
npm run typecheck
npm run build
git diff --name-only HEAD~3..HEAD | rg -n '(^|/)(\\.env|data/private|public/uploads)|\\.(xlsx|xls|pdf|ppt|pptx)$' || true
```

Expected:
- `typecheck` PASS.
- `build` PASS.
- sensitive file check prints nothing.

- [ ] **Step 3: Commit docs**

```bash
git add docs/PERMISSION_MATRIX.md docs/superpowers/plans/2026-07-20-permission-management-hierarchical-ui.md
git commit -m "docs: document hierarchical permission UI"
```

