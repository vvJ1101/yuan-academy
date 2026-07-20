import { prisma } from '../prisma'
import type { SessionUser } from '../auth'

// ── Default permissions per role (fallback if RolePermission not in DB) ──
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],  // wildcard = all permissions
  dept_admin: [
    'menu.dashboard', 'menu.recent', 'menu.favorites', 'menu.workspace',
    'menu.documents', 'menu.sop', 'menu.faq',
    'menu.admin', 'menu.admin.folders', 'menu.admin.analytics',
    'action.folders.create', 'action.folders.edit', 'action.folders.delete',
    'action.documents.upload', 'action.documents.edit', 'action.documents.delete',
    'action.faq.create', 'action.faq.edit', 'action.faq.delete',
  ],
  editor: [
    'menu.dashboard', 'menu.recent', 'menu.favorites', 'menu.workspace',
    'menu.documents', 'menu.sop', 'menu.faq',
    'action.documents.upload', 'action.documents.edit',
    'action.faq.create', 'action.faq.edit',
  ],
  viewer: [
    'menu.dashboard', 'menu.recent', 'menu.favorites', 'menu.workspace',
    'menu.documents', 'menu.sop',
  ],
}

// ── Cache ──
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

const SCOPE_PRIORITY: Record<PermissionDataScope['mode'], number> = {
  SELF: 1,
  CUSTOM: 2,
  DEPARTMENT: 3,
  COMPANY: 4,
  DEPARTMENT_AND_CHILDREN: 5,
  ALL: 6,
}

type ResolvedPermissions = {
  permissions: string[]
  dataScope: PermissionDataScope
}

const cache = new Map<string, ResolvedPermissions>()

function uniquePermissions(values: Iterable<string | null | undefined>): string[] {
  return Array.from(new Set(Array.from(values).filter((value): value is string => Boolean(value))))
}

function permissionListHas(permissions: Iterable<string>, key: string): boolean {
  const permissionSet = new Set(permissions)
  return permissionSet.has('*') || permissionSet.has(key)
}

function normalizeDataScope(value: unknown): PermissionDataScope {
  if (!value || typeof value !== 'object') return EMPTY_SCOPE
  const scope = value as Partial<PermissionDataScope>
  return {
    ...EMPTY_SCOPE,
    ...scope,
    companies: Array.isArray(scope.companies) ? scope.companies : [],
    departments: Array.isArray(scope.departments) ? scope.departments : [],
    folders: Array.isArray(scope.folders) ? scope.folders : [],
    users: Array.isArray(scope.users) ? scope.users : [],
  }
}

function scopeModeFromSysRole(value: number | null | undefined): PermissionDataScope['mode'] {
  if (value === 1) return 'ALL'
  if (value === 2) return 'DEPARTMENT_AND_CHILDREN'
  if (value === 3) return 'DEPARTMENT'
  if (value === 4) return 'SELF'
  if (value === 5) return 'CUSTOM'
  return 'SELF'
}

function parseJsonArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item)) : []
  } catch {
    return []
  }
}

function mergeRoleDataScopes(
  roles: Array<{ dataScope: number; customDeptIds: string }>,
  user: SessionUser,
): PermissionDataScope {
  if (user.role === 'super_admin') return { ...EMPTY_SCOPE, mode: 'ALL' }
  if (roles.length === 0) return EMPTY_SCOPE

  let mode: PermissionDataScope['mode'] = 'SELF'
  const departments = new Set<string>()
  const companies = new Set<string>()
  const users = new Set<string>()

  if (user.companyId) companies.add(user.companyId)
  if (user.departmentId) departments.add(user.departmentId)
  users.add(user.id)

  for (const role of roles) {
    const roleMode = scopeModeFromSysRole(role.dataScope)
    if (SCOPE_PRIORITY[roleMode] > SCOPE_PRIORITY[mode]) mode = roleMode
    for (const deptId of parseJsonArray(role.customDeptIds)) departments.add(deptId)
  }

  return {
    ...EMPTY_SCOPE,
    mode,
    companies: Array.from(companies),
    departments: Array.from(departments),
    users: Array.from(users),
  }
}

export const uniquePermissionsForTest = uniquePermissions
export const permissionListHasForTest = permissionListHas
export const mergeRoleDataScopesForTest = mergeRoleDataScopes

export function clearPermissionCache(userId?: string) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

/** Compute permissions for a user: UserPermission (override) > RolePermission > default */
export async function getUserPermissions(user: SessionUser): Promise<{
  permissions: string[]
  dataScope: PermissionDataScope
}> {
  if (cache.has(user.id)) return cache.get(user.id)!

  try {
    // 1. Check UserPermission (explicit override) via raw SQL
    const rows: any[] = await prisma.$queryRawUnsafe(
      'SELECT permissions, dataScope FROM UserPermission WHERE userId = ?', user.id
    )
    if (rows.length > 0) {
      const result = {
        permissions: uniquePermissions(JSON.parse(rows[0].permissions || '[]')),
        dataScope: normalizeDataScope(JSON.parse(rows[0].dataScope || '{}')),
      }
      cache.set(user.id, result)
      return result
    }

    // 2. Check admin-managed role menu permissions
    const userRoles = await prisma.sysUserRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            menus: { include: { menu: true } },
          },
        },
      },
    })

    const roleMenuPermissions = uniquePermissions(
      userRoles.flatMap(userRole => userRole.role.menus.map(roleMenu => roleMenu.menu.permission)),
    )

    if (roleMenuPermissions.length > 0) {
      const result = {
        permissions: user.role === 'super_admin'
          ? uniquePermissions(['*', ...roleMenuPermissions])
          : roleMenuPermissions,
        dataScope: mergeRoleDataScopes(userRoles.map(userRole => userRole.role), user),
      }
      cache.set(user.id, result)
      return result
    }

    // 3. Check legacy RolePermission via raw SQL
    const roleRows: any[] = await prisma.$queryRawUnsafe(
      'SELECT permissions FROM RolePermission WHERE role = ?', user.role
    )
    if (roleRows.length > 0) {
      const result = {
        permissions: uniquePermissions(JSON.parse(roleRows[0].permissions || '[]')),
        dataScope: EMPTY_SCOPE,
      }
      cache.set(user.id, result)
      return result
    }
  } catch (e) {
    // DB table might not exist yet — fall through to defaults
  }

  // 4. Fallback to defaults
  const result = {
    permissions: DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS.viewer,
    dataScope: EMPTY_SCOPE,
  }
  cache.set(user.id, result)
  return result
}

/** Check if user has a specific permission key */
export async function hasPermission(user: SessionUser, key: string): Promise<boolean> {
  const { permissions } = await getUserPermissions(user)
  return permissionListHas(permissions, key)
}

/** Check if user has any of the given permission keys */
export async function hasAnyPermission(user: SessionUser, keys: string[]): Promise<boolean> {
  const { permissions } = await getUserPermissions(user)
  if (permissionListHas(permissions, '*')) return true
  return keys.some(k => permissionListHas(permissions, k))
}

// ── Default role permission keys for seeding / reference ──
export const ALL_PERMISSION_KEYS = {
  menus: [
    { key: 'menu.dashboard', label: '首页' },
    { key: 'menu.recent', label: '最近访问' },
    { key: 'menu.favorites', label: '我的收藏' },
    { key: 'menu.workspace', label: '我的工作区' },
    { key: 'menu.documents', label: '文档管理' },
    { key: 'menu.search', label: '全局搜索' },
    { key: 'menu.ai', label: 'AI 助手' },
    { key: 'menu.brand', label: '品牌资料' },
    { key: 'menu.brand.ordering', label: '品牌资料 / 订货政策' },
    { key: 'menu.brand.contact', label: '品牌资料 / 品牌对接信息' },
    { key: 'menu.sop', label: 'SOP 流程' },
    { key: 'menu.faq', label: 'FAQ 管理' },
    { key: 'menu.admin', label: '管理中心' },
    { key: 'menu.admin.users', label: '用户管理' },
    { key: 'menu.admin.org', label: '组织架构' },
    { key: 'menu.admin.folders', label: '文件夹管理' },
    { key: 'menu.admin.analytics', label: '数据分析' },
    { key: 'menu.admin.audit', label: '审计日志' },
    { key: 'menu.admin.settings', label: '系统设置' },
    { key: 'menu.admin.roles', label: '角色管理' },
    { key: 'menu.admin.permissions', label: '权限管理' },
    { key: 'menu.admin.learningPaths', label: '学习路径' },
  ],
  actions: [
    { key: 'folder.create', label: '新建文件夹' },
    { key: 'folder.edit', label: '编辑文件夹' },
    { key: 'folder.delete', label: '删除文件夹' },
    { key: 'folder.permissionManage', label: '文件夹权限管理' },
    { key: 'document.upload', label: '文档上传' },
    { key: 'document.edit', label: '文档编辑' },
    { key: 'document.delete', label: '文档删除' },
    { key: 'document.replace', label: '替换文档' },
    { key: 'document.aiAnalyze', label: 'AI 解析' },
    { key: 'document.ocr', label: 'OCR 识别' },
    { key: 'document.downloadOriginal', label: '下载原文件' },
    { key: 'document.print', label: '打印文档' },
    { key: 'document.historyView', label: '查看历史版本' },
    { key: 'document.batchManage', label: '批量管理文档' },
    { key: 'favorite.create', label: '收藏文档' },
    { key: 'favorite.delete', label: '取消收藏' },
    { key: 'faq.create', label: '新建 FAQ' },
    { key: 'faq.edit', label: '编辑 FAQ' },
    { key: 'faq.delete', label: '删除 FAQ' },
    { key: 'brandOrdering.view', label: '订货政策 / 查看' },
    { key: 'brandOrdering.edit', label: '订货政策 / 编辑' },
    { key: 'brandOrdering.upload', label: '订货政策 / 上传更新' },
    { key: 'brandOrdering.parse', label: '订货政策 / AI 解析' },
    { key: 'brandOrdering.export', label: '订货政策 / 导出' },
    { key: 'brandOrdering.delete', label: '订货政策 / 删除单个品牌' },
    { key: 'brandOrdering.deleteAll', label: '订货政策 / 删除全部' },
    { key: 'brandContact.viewMarketFields', label: '品牌对接信息 / 查看市场字段' },
    { key: 'brandContact.viewFullFields', label: '品牌对接信息 / 查看完整字段' },
    { key: 'brandContact.edit', label: '品牌对接信息 / 网页编辑' },
    { key: 'brandContact.upload', label: '品牌对接信息 / 上传更新' },
    { key: 'brandContact.exportMarketFields', label: '品牌对接信息 / 导出市场字段' },
    { key: 'brandContact.exportFullFields', label: '品牌对接信息 / 导出完整字段' },
    { key: 'user.create', label: '新建用户' },
    { key: 'user.edit', label: '编辑用户' },
    { key: 'user.delete', label: '删除用户' },
    { key: 'user.batchDelete', label: '批量删除用户' },
    { key: 'user.assignCompany', label: '分配用户公司' },
    { key: 'org.companyCreate', label: '添加公司' },
    { key: 'org.companyEdit', label: '编辑公司' },
    { key: 'org.companyDelete', label: '删除公司' },
    { key: 'org.departmentCreate', label: '添加部门' },
    { key: 'org.departmentEdit', label: '编辑部门' },
    { key: 'org.departmentDelete', label: '删除部门' },
    { key: 'role.create', label: '添加角色' },
    { key: 'role.edit', label: '编辑角色' },
    { key: 'role.delete', label: '删除角色' },
    { key: 'role.assignPermission', label: '分配菜单/按钮权限' },
    { key: 'role.assignDataScope', label: '分配数据权限' },
    { key: 'role.assignUser', label: '选择角色用户' },
    { key: 'role.removeUser', label: '移除角色用户' },
    { key: 'analytics.view', label: '查看数据分析' },
    { key: 'audit.view', label: '查看审计日志' },
    { key: 'settings.manage', label: '系统设置管理' },
    { key: 'learningPath.create', label: '新建学习路径' },
    { key: 'learningPath.edit', label: '编辑学习路径' },
    { key: 'learningPath.delete', label: '删除学习路径' },
    { key: 'ai.chat', label: 'AI 对话' },
    { key: 'ai.search', label: 'AI 搜索' },
    { key: 'ai.recommend', label: 'AI 推荐' },
    { key: 'ai.risk', label: 'AI 风险分析' },
    { key: 'account.changePassword', label: '修改本人密码' },
  ],
}
