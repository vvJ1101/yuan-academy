import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth'

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
const cache = new Map<string, { permissions: string[]; dataScope: { companies: string[]; departments: string[] } }>()

export function clearPermissionCache(userId?: string) {
  if (userId) cache.delete(userId)
  else cache.clear()
}

/** Compute permissions for a user: UserPermission (override) > RolePermission > default */
export async function getUserPermissions(user: SessionUser): Promise<{
  permissions: string[]
  dataScope: { companies: string[]; departments: string[] }
}> {
  if (cache.has(user.id)) return cache.get(user.id)!

  try {
    // 1. Check UserPermission (explicit override) via raw SQL
    const rows: any[] = await prisma.$queryRawUnsafe(
      'SELECT permissions, dataScope FROM UserPermission WHERE userId = ?', user.id
    )
    if (rows.length > 0) {
      const result = {
        permissions: JSON.parse(rows[0].permissions || '[]'),
        dataScope: JSON.parse(rows[0].dataScope || '{}'),
      }
      cache.set(user.id, result)
      return result
    }

    // 2. Check RolePermission via raw SQL
    const roleRows: any[] = await prisma.$queryRawUnsafe(
      'SELECT permissions FROM RolePermission WHERE role = ?', user.role
    )
    if (roleRows.length > 0) {
      const result = {
        permissions: JSON.parse(roleRows[0].permissions || '[]'),
        dataScope: { companies: [], departments: [] },
      }
      cache.set(user.id, result)
      return result
    }
  } catch (e) {
    // DB table might not exist yet — fall through to defaults
  }

  // 3. Fallback to defaults
  const result = {
    permissions: DEFAULT_PERMISSIONS[user.role] || DEFAULT_PERMISSIONS.viewer,
    dataScope: { companies: [], departments: [] },
  }
  cache.set(user.id, result)
  return result
}

/** Check if user has a specific permission key */
export async function hasPermission(user: SessionUser, key: string): Promise<boolean> {
  const { permissions } = await getUserPermissions(user)
  if (permissions.includes('*')) return true
  return permissions.includes(key)
}

/** Check if user has any of the given permission keys */
export async function hasAnyPermission(user: SessionUser, keys: string[]): Promise<boolean> {
  const { permissions } = await getUserPermissions(user)
  if (permissions.includes('*')) return true
  return keys.some(k => permissions.includes(k))
}

// ── Default role permission keys for seeding / reference ──
export const ALL_PERMISSION_KEYS = {
  menus: [
    { key: 'menu.dashboard', label: '首页' },
    { key: 'menu.recent', label: '最近访问' },
    { key: 'menu.favorites', label: '我的收藏' },
    { key: 'menu.workspace', label: '我的工作区' },
    { key: 'menu.documents', label: '文档管理' },
    { key: 'menu.sop', label: 'SOP 流程' },
    { key: 'menu.faq', label: 'FAQ 管理' },
    { key: 'menu.admin', label: '管理中心' },
    { key: 'menu.admin.users', label: '用户管理' },
    { key: 'menu.admin.org', label: '组织架构' },
    { key: 'menu.admin.folders', label: '文件夹管理' },
    { key: 'menu.admin.analytics', label: '数据分析' },
    { key: 'menu.admin.settings', label: '系统设置' },
    { key: 'menu.admin.permissions', label: '权限管理' },
    { key: 'menu.admin.learningPaths', label: '学习路径' },
  ],
  actions: [
    { key: 'action.folders.create', label: '新建文件夹' },
    { key: 'action.folders.edit', label: '编辑文件夹' },
    { key: 'action.folders.delete', label: '删除文件夹' },
    { key: 'action.documents.upload', label: '文档上传' },
    { key: 'action.documents.edit', label: '文档编辑' },
    { key: 'action.documents.delete', label: '文档删除' },
    { key: 'action.documents.analyze', label: 'AI 解析' },
    { key: 'action.faq.create', label: '新建 FAQ' },
    { key: 'action.faq.edit', label: '编辑 FAQ' },
    { key: 'action.faq.delete', label: '删除 FAQ' },
    { key: 'action.users.create', label: '新建用户' },
    { key: 'action.users.edit', label: '编辑用户' },
    { key: 'action.users.delete', label: '删除用户' },
    { key: 'action.org.manage', label: '组织架构管理' },
    { key: 'action.settings.manage', label: '系统设置管理' },
  ],
}
