import type { SessionUser } from '../auth'

export type ResolvedPermission = 'view' | 'edit' | 'delete' | 'admin'
const LEVEL: Record<ResolvedPermission, number> = { view: 1, edit: 2, delete: 3, admin: 4 }

function normalize(permission: string | null): ResolvedPermission | null {
  if (permission === 'download' || permission === 'upload') return 'view'
  return permission === 'view' || permission === 'edit' || permission === 'delete' || permission === 'admin' ? permission : null
}

function match(rule: { companyId: string | null; departmentId: string | null; userId: string | null; role: string | null; permission: string }, user: SessionUser) {
  if (rule.userId && rule.userId === user.id) return normalize(rule.permission)
  if (rule.role && rule.role === user.role) return normalize(rule.permission)
  if (rule.departmentId && rule.departmentId === user.departmentId) return normalize(rule.permission)
  if (rule.companyId && rule.companyId === user.companyId) return normalize(rule.permission)
  return null
}

export function resolveDocumentPermission(
  user: SessionUser,
  document: {
    folderId: string | null
    ownerDeptId: string | null
    overridePermissions: boolean
    audiences: Array<{ departmentId: string }>
    documentPermissions: Array<{ companyId: string | null; departmentId: string | null; userId: string | null; role: string | null; permission: string }>
  },
  folderPermission: ResolvedPermission | null,
): ResolvedPermission | null {
  if (user.role === 'super_admin') return 'admin'
  if (document.overridePermissions) {
    let best: ResolvedPermission | null = null
    for (const rule of document.documentPermissions) {
      const matched = match(rule, user)
      if (matched && (!best || LEVEL[matched] > LEVEL[best])) best = matched
    }
    return best
  }
  if (folderPermission) return folderPermission
  if (document.ownerDeptId && user.departmentId === document.ownerDeptId) return user.role === 'dept_admin' ? 'admin' : 'edit'
  if (user.departmentId && document.audiences.some(audience => audience.departmentId === user.departmentId)) return 'view'
  return null
}
