# System-wide Permission Management Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade YUAN Academy into a system-wide permission center where all pages, buttons, APIs, and data ranges are controlled by assigned permissions.

**Architecture:** Use `SysMenu / SysRoleMenu` as the menu/button permission source because the current admin UI already manages this tree. Combine it with role data scope so every check has two parts: capability permission, meaning “can do what”, and data scope, meaning “can do it to which data”. Keep `UserPermission` as an optional user-level override, expose resolved permissions through `/api/auth/me`, and make backend APIs call shared permission guards.

**Tech Stack:** Next.js 14 App Router, Prisma, SQLite, TypeScript, Node test runner, Tailwind CSS.

## Current Implementation Status — 2026-07-20

本轮已经把“权限管理模块可以完全推翻”的需求落成一套统一方向：菜单权限、按钮权限、API 守卫、数据权限共同生效。当前分支为 `codex/dependency-security-upgrade`，本地已保存为 17 个提交，尚未推送到远端。

### 已完成

- 建立 `docs/PERMISSION_MATRIX.md`，作为页面、按钮、API、数据范围的权限基准表。
- 将权限解析统一到 `src/lib/permissions/rbac.ts`：优先读取用户覆盖权限，其次读取后台角色菜单权限，再兼容旧角色权限和默认角色。
- 新增 `src/lib/permissions/guards.ts`，后端接口可统一调用 `requirePermission()` / `requireAnyPermission()`。
- 角色权限页已改造为“权限树 + 数据权限 + 用户分配”的统一入口。
- 侧边栏、管理中心入口、文档工作区动作、订货政策和品牌对接信息按钮已接入权限可见性。
- 高风险写接口已补服务器端权限守卫：用户、组织、文件夹、角色、文档、FAQ、订货政策、品牌对接信息等。
- AI、搜索、收藏、下载/打印、首页推荐、SOP、订货政策、历史记录等读/工具接口已补后端门禁与数据过滤。
- 文档原文件下载、打印和历史记录已拆成独立权限点，预览不等于可下载/打印。
- 已运行并通过：
  - `npm run typecheck`
  - `npm run build`

### 最近新增的安全修复提交

- `5f7acfe fix: guard ai bookmarks and file access APIs`
  - AI 对话 / AI 搜索 / AI 推荐 / AI 风险分析补权限。
  - 收藏列表和收藏动作补权限，并按可见文档范围过滤。
  - 文档文件接口补原文件下载和打印权限。
- `d1d5d0c fix: close remaining read permission gaps`
  - 普通搜索补 `menu.search`。
  - 首页推荐和 Dashboard 热门文档二次查询补数据范围过滤。
  - 文档历史记录补 `document.historyView`。
  - 订货政策模板、品牌对接模板下载改为上传权限用户可访问。
- `957adbe fix: enforce menu permissions on page APIs`
  - Dashboard、首页推荐、SOP、订货政策、后台菜单树、后台部门树等页面级 API 补菜单权限。
- `376cbe0 fix: filter document graph and align permission keys`
  - 文档关系图的前置、相关、依赖、同阶段文档全部按可见文档范围过滤。
  - 用户公司归属读取改为按用户管理权限判断，不再写死超级管理员。
  - RBAC 兜底权限列表补齐新菜单和按钮权限 key。

### 下一步建议

1. 做一轮手工账号验证：超级管理员、商品部、市场部、普通 viewer 各登录一次，看菜单、按钮和 API 返回是否符合预期。
2. 补充更细的数据权限自动化测试，尤其是 `COMPANY`、`DEPARTMENT`、`DEPARTMENT_AND_CHILDREN`、`CUSTOM` 四类。
3. 再检查组织/公司只读接口是否要从“登录可读”收紧为“按页面来源授权读取”。这部分可能被文档筛选、用户表单复用，需要先确认前端调用路径，避免误伤。
4. 推送分支并创建 PR，进入部署前 Review。

## Global Constraints

- Do not modify `src/lib/parser.ts`, `src/lib/prompts/*.ts`, `scripts/fts-migrate.ts`, or `src/types/dashboard.ts`.
- Department and company names must not be used as hardcoded authorization rules for business features.
- Frontend button visibility is not security; every write API must check permissions on the server.
- Every changed `POST` / `PUT` / `DELETE` API must keep or add audit logging.
- Keep private Excel-derived data under `data/private/`; do not commit private source spreadsheets or generated private JSON.
- Super admin wildcard `*` must keep full access to avoid locking out administration.
- Convert permissions by phase. Do not attempt to convert every page and every API in one commit.

---

## File Structure

- Create: `docs/PERMISSION_MATRIX.md` — full page/button/API/data-scope inventory.
- Modify: `src/lib/permissions/rbac.ts` — single permission resolver for capability permissions and role data scope.
- Create: `src/lib/permissions/guards.ts` — reusable page/action/data permission guards.
- Modify: `src/app/api/user/permissions/route.ts` — delegate to `getUserPermissions()` for compatibility.
- Modify: `src/app/api/admin/roles/[id]/permissions/route.ts` — check `role.assignPermission` and clear permission cache after updates.
- Modify: `src/app/api/admin/roles/[id]/dataScope/route.ts` — check `role.assignDataScope` and clear permission cache after updates.
- Modify: `src/components/internal/permissions-management/index.tsx` — combine menu/button permission and data permission management more clearly.
- Modify: `scripts/seed-rbac-full.ts` — seed the full system permission tree.
- Modify high-risk APIs first: users, companies, departments, folders, folder permissions, roles, policy, brand data.
- Modify high-risk pages first: users, org, folders, roles, policy, brand data, sidebar.
- Add or update tests under `src/lib/__tests__/`.
- Update permission documentation after implementation.

---

### Task 1: Build Full Permission Inventory

**Files:**
- Create: `docs/PERMISSION_MATRIX.md`

**Interfaces:**
- Consumes: current `/internal/*` routes, sidebar links, admin pages, and `POST` / `PUT` / `DELETE` APIs.
- Produces: one matrix mapping page, button, API, and data scope requirements.

- [ ] **Step 1: Create the matrix document**

Create `docs/PERMISSION_MATRIX.md`:

```md
# YUAN Academy Permission Matrix

> This matrix is the source of truth for page, button, API, and data-scope permissions.

## Permission Layers

- Menu permission: controls page entry and navigation visibility.
- Action permission: controls buttons, writes, exports, downloads, deletes, AI actions.
- API guard: server-side enforcement for the same action.
- Data scope: controls which records, folders, documents, users, departments, or brand data the permission applies to.

## Matrix

| Module | Page / API | Permission | Data Scope | Notes |
|---|---|---|---|---|
| 首页 | `/internal/dashboard` | `menu.dashboard` | visible documents | Dashboard counts must filter by accessible data |
| 最近访问 | `/internal/recent` | `menu.recent` | visible documents | Only show accessible activity |
| 我的收藏 | `/internal/favorites` | `menu.favorites` | visible documents | Bookmark actions also require bookmark permissions |
| 文档中心 | `/internal/documents` | `menu.documents` | folder/document scope | List only accessible folders/documents |
| 文档上传 | `POST /api/documents` | `document.upload` + folder edit/admin | target folder | Requires both action and folder permission |
| 文档编辑 | document edit UI / API | `document.edit` + document edit/admin | target document | Must preserve document history |
| 文档删除 | document delete UI / API | `document.delete` + document delete/admin | target document | Requires second confirmation |
| 原文件下载 | `/api/documents/[id]/file?variant=original` | `document.downloadOriginal` + document edit/admin | target document | View permission can preview but not download original |
| 打印 | document file print purpose | `document.print` + document edit/admin | target document | View permission cannot print |
| 文件夹管理 | `/internal/admin/folders` | `menu.admin.folders` | folder scope | Admin page entry |
| 新建文件夹 | `POST /api/folders` | `folder.create` | parent folder/company | Requires audit |
| 编辑文件夹 | `PUT /api/folders` | `folder.edit` | target folder | Requires audit |
| 删除文件夹 | `DELETE /api/folders` | `folder.delete` | target folder | Requires audit and confirmation |
| 文件夹权限 | `/api/folders/permissions` | `folder.permissionManage` | target folder | Requires audit |
| 用户管理 | `/internal/admin/users` | `menu.admin.users` | user data scope | Entry only |
| 新建用户 | `POST /api/users` | `user.create` | manageable org scope | Requires audit |
| 编辑用户 | `PUT /api/users` | `user.edit` | manageable org scope | Requires audit |
| 删除用户 | `DELETE /api/users` | `user.delete` | manageable org scope | Requires audit |
| 组织架构 | `/internal/admin/org` | `menu.admin.org` | org data scope | Entry only |
| 公司管理 | `/api/companies` write methods | `org.companyCreate/Edit/Delete` | org scope | Requires audit |
| 部门管理 | `/api/departments` write methods | `org.departmentCreate/Edit/Delete` | org scope | Requires audit |
| 角色管理 | `/internal/admin/role-permissions` | `menu.admin.roles` | role admin scope | Entry only |
| 角色增删改 | `/api/admin/roles` write methods | `role.create/edit/delete` | role admin scope | Requires audit |
| 分配权限 | `/api/admin/roles/[id]/permissions` | `role.assignPermission` | role admin scope | Clears permission cache |
| 数据权限 | `/api/admin/roles/[id]/dataScope` | `role.assignDataScope` | role admin scope | Clears permission cache |
| 选择用户 | role user assignment APIs | `role.assignUser` | role admin scope | Requires audit |
| 审计日志 | `/internal/admin/audit-log` | `menu.admin.audit` + `audit.view` | audit data scope | Read only |
| 统计分析 | `/internal/admin/analytics` | `menu.admin.analytics` + `analytics.view` | data scope | Aggregates filtered data |
| 系统设置 | `/internal/admin/settings` | `menu.admin.settings` + `settings.manage` | global | Super admin recommended |
| 品牌资料 | `/internal/brand` | `menu.brand` | brand data scope | Parent menu |
| 订货政策 | `/internal/policy` | `menu.brand.ordering` + `brandOrdering.view` | brand data scope | View cards |
| 订货政策编辑 | `PUT /api/admin/policy` | `brandOrdering.edit` | brand data scope | Requires audit |
| 订货政策上传 | `POST /api/admin/policy-upload` | `brandOrdering.upload` | brand data scope | Requires audit |
| 品牌对接信息 | `/internal/brand?type=contact` | `menu.brand.contact` + field view permission | brand field scope | Market/full views |
| 品牌对接编辑 | `PUT /api/admin/brand-data` | `brandContact.edit` | full field scope | Requires audit |
| 品牌对接上传 | `POST /api/admin/brand-data/upload` | `brandContact.upload` | full field scope | Requires audit |
| SOP | `/internal/sop` | `menu.sop` | visible documents | Filtered by document scope |
| FAQ | `/internal/faq` | `menu.faq` | FAQ data scope | CRUD must be guarded |
| AI 搜索 | `/api/ai/search` | `ai.search` | visible documents | Query results must be filtered |
| AI 推荐 | `/api/ai/recommend` | `ai.recommend` | visible documents | Results must be filtered |
| 风险分析 | `/api/ai/risk` | `ai.risk` | visible documents | Results must be filtered |
```

- [ ] **Step 2: Verify inventory against source**

Run:

```bash
rg -n "export async function (POST|PUT|DELETE)|method: 'POST'|method: 'PUT'|method: 'DELETE'|href=\"/internal|href: '/internal" src/app src/components src/api
```

Expected: every write route and important page has a row in `docs/PERMISSION_MATRIX.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/PERMISSION_MATRIX.md
git commit -m "docs: add system permission matrix"
```

---

### Task 2: Add RBAC Pure Helper Tests

**Files:**
- Modify: `src/lib/permissions/rbac.ts`
- Create: `src/lib/__tests__/rbac.test.ts`

**Interfaces:**
- Produces:
  - `uniquePermissionsForTest(values: Iterable<string | null | undefined>): string[]`
  - `permissionListHasForTest(permissions: Iterable<string>, key: string): boolean`

- [ ] **Step 1: Write tests**

Create `src/lib/__tests__/rbac.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearPermissionCache,
  permissionListHasForTest,
  uniquePermissionsForTest,
} from '../permissions/rbac'

test('clearPermissionCache can clear one user or all users without throwing', () => {
  assert.doesNotThrow(() => clearPermissionCache('user-1'))
  assert.doesNotThrow(() => clearPermissionCache())
})

test('uniquePermissionsForTest removes blanks and duplicates', () => {
  assert.deepEqual(
    uniquePermissionsForTest(['menu.brand', '', null, undefined, 'menu.brand', 'brandContact.edit']),
    ['menu.brand', 'brandContact.edit'],
  )
})

test('permissionListHasForTest supports wildcard and exact permission keys', () => {
  assert.equal(permissionListHasForTest(['*'], 'user.delete'), true)
  assert.equal(permissionListHasForTest(['user.delete'], 'user.delete'), true)
  assert.equal(permissionListHasForTest(['user.edit'], 'user.delete'), false)
})
```

- [ ] **Step 2: Export testable pure helpers**

In `src/lib/permissions/rbac.ts`, add:

```ts
function uniquePermissions(values: Iterable<string | null | undefined>): string[] {
  return Array.from(new Set(Array.from(values).filter((value): value is string => Boolean(value))))
}

function permissionListHas(permissions: Iterable<string>, key: string): boolean {
  const permissionSet = new Set(permissions)
  return permissionSet.has('*') || permissionSet.has(key)
}

export const uniquePermissionsForTest = uniquePermissions
export const permissionListHasForTest = permissionListHas
```

- [ ] **Step 3: Run tests**

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowImportingTsExtensions":false}' node --require ts-node/register --test src/lib/__tests__/rbac.test.ts
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions/rbac.ts src/lib/__tests__/rbac.test.ts
git commit -m "test: cover rbac permission helpers"
```

---

### Task 3: Unify Capability Permissions and Data Scope

**Files:**
- Modify: `src/lib/permissions/rbac.ts`
- Modify: `src/app/api/user/permissions/route.ts`

**Interfaces:**
- Produces:
  - `PermissionDataScope`
  - `getUserPermissions(user)`
  - `hasPermission(user, key)`
  - `hasAnyPermission(user, keys)`

- [ ] **Step 1: Add data scope type**

In `src/lib/permissions/rbac.ts`, add:

```ts
export type PermissionDataScope = {
  mode: 'ALL' | 'COMPANY' | 'DEPARTMENT' | 'DEPARTMENT_AND_CHILDREN' | 'SELF' | 'CUSTOM'
  companies: string[]
  departments: string[]
  folders: string[]
  users: string[]
}

const EMPTY_SCOPE: PermissionDataScope = {
  mode: 'SELF',
  companies: [],
  departments: [],
  folders: [],
  users: [],
}
```

- [ ] **Step 2: Resolve permissions from admin-managed role tree**

Change `getUserPermissions()` so its priority is:

```text
1. UserPermission override, if present
2. SysUserRole -> SysRoleMenu -> SysMenu.permission
3. RolePermission fallback
4. DEFAULT_PERMISSIONS fallback
```

When `session.role === 'super_admin'`, include `*`.

- [ ] **Step 3: Make `/api/user/permissions` delegate to RBAC**

Replace direct `sysUserRole` querying with:

```ts
const rbac = await getUserPermissions(session)
return NextResponse.json({
  code: 0,
  data: {
    permissions: rbac.permissions,
    menuIds: [],
    roles: [],
    dataScope: rbac.dataScope,
  },
})
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck
```

Expected: typecheck passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions/rbac.ts src/app/api/user/permissions/route.ts
git commit -m "refactor: unify capability permissions and data scope"
```

---

### Task 4: Add Shared Permission Guards

**Files:**
- Create: `src/lib/permissions/guards.ts`
- Create: `src/lib/__tests__/permission-guards.test.ts`

**Interfaces:**
- Produces:
  - `hasResolvedPermission(permissions, key)`
  - `requirePermission(session, key, message?)`
  - `requireAnyPermission(session, keys, message?)`

- [ ] **Step 1: Create guard helpers**

Create `src/lib/permissions/guards.ts`:

```ts
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/auth'
import { getUserPermissions } from './rbac'

export function hasResolvedPermission(permissions: Iterable<string>, key: string): boolean {
  const set = new Set(permissions)
  return set.has('*') || set.has(key)
}

export async function requirePermission(
  session: SessionUser | null,
  key: string,
  message = '无权执行该操作',
): Promise<{ ok: true; permissions: string[] } | { ok: false; response: NextResponse }> {
  if (!session?.id) {
    return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) }
  }
  const { permissions } = await getUserPermissions(session)
  if (!hasResolvedPermission(permissions, key)) {
    return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) }
  }
  return { ok: true, permissions }
}

export async function requireAnyPermission(
  session: SessionUser | null,
  keys: string[],
  message = '无权执行该操作',
): Promise<{ ok: true; permissions: string[] } | { ok: false; response: NextResponse }> {
  if (!session?.id) {
    return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) }
  }
  const { permissions } = await getUserPermissions(session)
  if (!keys.some(key => hasResolvedPermission(permissions, key))) {
    return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) }
  }
  return { ok: true, permissions }
}
```

- [ ] **Step 2: Add tests**

Create `src/lib/__tests__/permission-guards.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { hasResolvedPermission } from '../permissions/guards'

test('hasResolvedPermission supports wildcard and exact keys', () => {
  assert.equal(hasResolvedPermission(['*'], 'folder.delete'), true)
  assert.equal(hasResolvedPermission(['folder.delete'], 'folder.delete'), true)
  assert.equal(hasResolvedPermission(['folder.edit'], 'folder.delete'), false)
})
```

- [ ] **Step 3: Verify**

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowImportingTsExtensions":false}' node --require ts-node/register --test src/lib/__tests__/permission-guards.test.ts
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions/guards.ts src/lib/__tests__/permission-guards.test.ts
git commit -m "feat: add shared permission guards"
```

---

### Task 5: Clear Permission Cache After Permission and Data Scope Updates

**Files:**
- Modify: `src/app/api/admin/roles/[id]/permissions/route.ts`
- Modify: `src/app/api/admin/roles/[id]/dataScope/route.ts`

**Interfaces:**
- Consumes: `clearPermissionCache(userId?: string)`.
- Produces: role permission and data scope changes take effect after page refresh.

- [ ] **Step 1: Import cache helper**

Add:

```ts
import { clearPermissionCache } from '@/lib/permissions/rbac'
```

- [ ] **Step 2: Clear cache after successful updates**

After successful permission or data scope save:

```ts
clearPermissionCache()
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/roles/[id]/permissions/route.ts src/app/api/admin/roles/[id]/dataScope/route.ts
git commit -m "fix: clear permission cache after role changes"
```

---

### Task 6: Upgrade Menu and Data Permission Management UI

**Files:**
- Modify: `src/components/internal/permissions-management/index.tsx`

**Interfaces:**
- Consumes role permission APIs and role data scope APIs.
- Produces one clearer role configuration experience.

- [ ] **Step 1: Add explanatory copy**

Add above the permission assignment tree:

```tsx
<div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
  菜单权限控制页面入口，按钮权限控制能不能执行操作；真正能操作哪些数据，由“数据权限”决定。
</div>
```

- [ ] **Step 2: Add data permission explanation**

Add above the data scope selector:

```tsx
<div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
  数据权限决定这个角色能管理哪些数据，例如全部、本公司、本部门、本部门及下级、本人或自定义范围。
</div>
```

- [ ] **Step 3: Add dangerous permission confirmation copy**

When selecting `ALL` data scope, display:

```ts
message.warning('该角色将能查看授权模块下的全部数据，请确认这是有意分配。')
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck
```

Expected: typecheck passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/internal/permissions-management/index.tsx
git commit -m "feat: clarify menu and data permission management"
```

---

### Task 7: Seed Full System Permission Tree

**Files:**
- Modify: `scripts/seed-rbac-full.ts`

**Interfaces:**
- Consumes existing idempotent `upsertMenu(def, parentId?)`.
- Produces a role permission tree that covers all major pages and buttons.

- [ ] **Step 1: Add or normalize permission groups**

Ensure `scripts/seed-rbac-full.ts` seeds groups for:

```text
首页
知识空间
品牌资料
智能应用
系统管理
```

Include button permissions from `docs/PERMISSION_MATRIX.md`, especially:

```text
document.upload
document.edit
document.delete
document.downloadOriginal
document.print
folder.create
folder.edit
folder.delete
folder.permissionManage
user.create
user.edit
user.delete
org.companyCreate
org.companyEdit
org.companyDelete
org.departmentCreate
org.departmentEdit
org.departmentDelete
role.create
role.edit
role.delete
role.assignPermission
role.assignDataScope
role.assignUser
brandOrdering.view
brandOrdering.edit
brandOrdering.upload
brandOrdering.export
brandOrdering.delete
brandContact.viewMarketFields
brandContact.viewFullFields
brandContact.edit
brandContact.upload
brandContact.exportMarketFields
brandContact.exportFullFields
audit.view
analytics.view
settings.manage
ai.search
ai.recommend
ai.risk
```

- [ ] **Step 2: Keep old permission keys as compatibility**

Do not delete old `menu.policy`, `menu.policyUpload`, or old colon-style permissions in this task. Existing roles may rely on them.

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-rbac-full.ts
git commit -m "feat: seed full system permission tree"
```

---

### Task 8: Convert Brand and Ordering Policy to Unified Guards

**Files:**
- Modify: `src/lib/brand-data-access.ts`
- Modify: `src/lib/policy-access.ts`
- Modify: `src/app/api/admin/brand-data/route.ts`
- Modify: `src/app/api/admin/brand-data/upload/route.ts`
- Modify: `src/app/api/admin/policy/route.ts`
- Modify: `src/app/api/admin/policy-upload/route.ts`
- Modify tests under `src/lib/__tests__/`.

**Interfaces:**
- Consumes unified RBAC and guards.
- Produces brand and ordering policy permissions that are no longer department-hardcoded.

- [ ] **Step 1: Make brand access use `getUserPermissions()`**

Replace direct `SysRoleMenu` queries in `src/lib/brand-data-access.ts` with the shared resolver.

- [ ] **Step 2: Make ordering access permission-based**

Add pure helpers:

```ts
export function canEditPolicyFromPermissions(permissions: Iterable<string>, role: string): boolean
export function canUploadPolicyFromPermissions(permissions: Iterable<string>, role: string): boolean
```

Use `brandOrdering.edit` and `brandOrdering.upload`.

- [ ] **Step 3: Update admin policy routes to await async guards**

Use:

```ts
if (!(await canUploadPolicy(session))) {
  return NextResponse.json({ error: '无权上传订货政策' }, { status: 403 })
}
```

- [ ] **Step 4: Verify**

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowImportingTsExtensions":false}' node --require ts-node/register --test src/lib/__tests__/brand-data-access.test.ts src/lib/__tests__/policy-access.test.ts
npm run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand-data-access.ts src/lib/policy-access.ts src/app/api/admin/brand-data src/app/api/admin/policy src/app/api/admin/policy-upload/route.ts src/lib/__tests__
git commit -m "fix: use unified permissions for brand and ordering access"
```

---

### Task 9: Protect High-risk Admin Write APIs

**Files:**
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/companies/route.ts`
- Modify: `src/app/api/departments/route.ts`
- Modify: `src/app/api/folders/route.ts`
- Modify: `src/app/api/folders/permissions/route.ts`
- Modify: `src/app/api/admin/roles/**`

**Interfaces:**
- Consumes `requirePermission()`.
- Produces server-side enforcement for major admin writes.

- [ ] **Step 1: Guard user writes**

Use `user.create`, `user.edit`, `user.delete` for corresponding methods.

- [ ] **Step 2: Guard organization writes**

Use:

```text
org.companyCreate
org.companyEdit
org.companyDelete
org.departmentCreate
org.departmentEdit
org.departmentDelete
```

- [ ] **Step 3: Guard folder writes**

Use:

```text
folder.create
folder.edit
folder.delete
folder.permissionManage
```

Folder operations must still also check target folder data permission.

- [ ] **Step 4: Guard role writes**

Use:

```text
role.create
role.edit
role.delete
role.assignPermission
role.assignDataScope
role.assignUser
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/users src/app/api/companies src/app/api/departments src/app/api/folders src/app/api/admin/roles src/lib/permissions/guards.ts
git commit -m "fix: enforce permissions on admin write APIs"
```

---

### Task 10: Align High-risk Page Buttons with Permissions

**Files:**
- Modify: `src/components/internal/internal-sidebar.tsx`
- Modify: `src/app/internal/admin/users/page.tsx`
- Modify: `src/app/internal/admin/org/page.tsx`
- Modify: `src/app/internal/admin/folders/page.tsx`
- Modify: `src/app/internal/policy/page.tsx`
- Modify: `src/app/internal/brand/page.tsx`

**Interfaces:**
- Consumes `/api/auth/me` permissions.
- Produces buttons that show only when the matching permission exists.

- [ ] **Step 1: Use `/api/auth/me` as primary permission source**

Sidebar and pages should use resolved permissions from `/api/auth/me`. Keep `/api/user/permissions` only as temporary fallback during migration.

- [ ] **Step 2: Map buttons to permissions**

Examples:

```text
添加角色 -> role.create
分配权限 -> role.assignPermission
数据权限 -> role.assignDataScope
选择用户 -> role.assignUser
添加用户 -> user.create
删除用户 -> user.delete
新建文件夹 -> folder.create
文件夹权限 -> folder.permissionManage
订货政策上传 -> brandOrdering.upload
品牌对接编辑 -> brandContact.edit
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/internal/internal-sidebar.tsx src/app/internal/admin/users/page.tsx src/app/internal/admin/org/page.tsx src/app/internal/admin/folders/page.tsx src/app/internal/policy/page.tsx src/app/internal/brand/page.tsx
git commit -m "fix: align page buttons with assigned permissions"
```

---

### Task 11: Full Verification and Documentation

**Files:**
- Modify: `docs/PERMISSION_MATRIX.md`
- Modify: `docs/ORDERING_POLICY_SECURITY.md`
- Modify: `docs/ACADEMY_OPTIMIZATION_DESIGN.md` if present and relevant.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified implementation and operator documentation.

- [ ] **Step 1: Run full verification**

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node","allowImportingTsExtensions":false}' node --require ts-node/register --test src/lib/__tests__/brand-data-access.test.ts src/lib/__tests__/policy-access.test.ts src/lib/__tests__/rbac.test.ts src/lib/__tests__/permission-guards.test.ts
npm run typecheck
npm run build
```

Expected: all tests, typecheck, and build pass.

- [ ] **Step 2: Update docs**

Add:

```md
## 权限管理说明

- 权限分配以管理中心的角色权限树和数据权限配置为准。
- 菜单权限控制页面入口，按钮权限控制操作能力，数据权限控制作用范围。
- 部门只作为默认角色模板和数据范围，不作为业务功能的后端硬编码判断依据。
- 前端隐藏按钮只是体验优化，后端 API 必须进行同等权限校验。
```

- [ ] **Step 3: Commit**

```bash
git add docs/PERMISSION_MATRIX.md docs/ORDERING_POLICY_SECURITY.md docs/ACADEMY_OPTIMIZATION_DESIGN.md
git commit -m "docs: document system permission model"
```

---

## Rollback Plan

Rollback by commit boundary:

1. If permission resolution breaks login or menus, revert Task 3.
2. If shared guards introduce unexpected API failures, revert Task 4 and affected API commits.
3. If role updates do not refresh correctly, revert Task 5 only.
4. If management UI becomes confusing, revert Task 6 only.
5. If seeded permission tree causes confusion, do not run `scripts/seed-rbac-full.ts` in production, or restore the database backup taken before seeding.

Super admin `*` access must remain untouched in every rollback path.

## Execution Choice

Recommended path:

1. Task 1: inventory first, because this is now a whole-system upgrade.
2. Task 2-5: build unified permission foundation.
3. Task 6-7: upgrade management UI and permission tree.
4. Task 8-10: connect business modules and high-risk APIs.
5. Task 11: full verification and docs before push/deploy.
