/**
 * YUAN SHOWROOM — Document Permission System v5 (UNIFIED 4-LEVEL)
 *
 * Architecture:
 *   Folder → FolderPermission rules → inherit to children
 *   Document inherits folder permissions (unless overridePermissions=true)
 *   Legacy ownerDeptId + audiences retained as fallback
 *
 * Permission levels: view < edit < delete < admin
 * Backward compat: old "download"/"upload" → "view"
 */

import type { SessionUser } from '@/lib/auth'

export type Permission = 'view' | 'edit' | 'delete' | 'admin'

const PERM_LEVEL: Record<Permission, number> = { view: 1, edit: 2, delete: 3, admin: 4 }

function hasPerm(userLevel: Permission | null, required: Permission): boolean {
  if (!userLevel) return false
  return PERM_LEVEL[userLevel] >= PERM_LEVEL[required]
}

// ── Public helpers ──

export function canView(p: Permission | null): boolean { return hasPerm(p, 'view') }
export function canEdit(p: Permission | null): boolean { return hasPerm(p, 'edit') }
export function canDelete(p: Permission | null): boolean { return hasPerm(p, 'delete') }
export function canAdmin(p: Permission | null): boolean { return hasPerm(p, 'admin') }

// ── READ ──

/**
 * READ permission (document-level).
 * Priority: super_admin > document override > folder inheritance > legacy ownerDept + audiences
 */
export function canReadDocument(
  user: SessionUser,
  doc: { ownerDeptId?: string | null; audiences?: { departmentId: string }[] | string[] | null; folderId?: string | null },
  folderPerm?: Permission | null,
): boolean {
  if (user.role === 'super_admin') return true
  if (!user.departmentId) return false

  // 1. Legacy: ownerDept match
  if (doc.ownerDeptId && doc.ownerDeptId === user.departmentId) return true

  // 2. Legacy: audience match
  if (doc.audiences) {
    const ids = (doc.audiences as any[]).map((a: any) => typeof a === 'string' ? a : a?.departmentId).filter(Boolean)
    if (ids.includes(user.departmentId)) return true
  }

  // 3. Folder permission
  if (folderPerm && hasPerm(folderPerm, 'view')) return true

  return false
}

// ── Policy document guard ──

/** Check if user can edit/delete policy (订货政策) documents.
 *  Policy docs: category='policy' → only super_admin OR (时胜 + 品牌部) can write. */
export function checkPolicyPermission(user: SessionUser): boolean {
  if (user.role === 'super_admin') return true
  if (user.companyName === '时胜' && user.departmentName === '品牌部') return true
  return false
}

// ── WRITE ──

/**
 * EDIT permission (document-level).
 * super_admin > policy check > folder admin/edit > legacy ownerDept
 */
export function canEditDocument(
  user: SessionUser,
  docOwnerDeptId?: string | null,
  folderPerm?: Permission | null,
  docCategory?: string | null,
): boolean {
  if (user.role === 'super_admin') return true
  if (!user.departmentId) return false

  // 0. Policy documents: only 时胜+品牌部 or super_admin
  if (docCategory === 'policy' && !checkPolicyPermission(user)) return false

  // 1. Folder permission (admin or edit level)
  if (folderPerm && hasPerm(folderPerm, 'edit')) return true

  // 2. Legacy: ownerDept match
  if (docOwnerDeptId && user.departmentId === docOwnerDeptId) return true

  return false
}

export function canDeleteDocument(
  user: SessionUser,
  docOwnerDeptId?: string | null,
  folderPerm?: Permission | null,
  docCategory?: string | null,
): boolean {
  if (user.role === 'super_admin') return true
  if (!user.departmentId) return false

  // 0. Policy documents: only 时胜+品牌部 or super_admin
  if (docCategory === 'policy' && !checkPolicyPermission(user)) return false

  if (folderPerm && hasPerm(folderPerm, 'delete')) return true
  if (docOwnerDeptId && user.departmentId === docOwnerDeptId) return true

  return false
}

export function canUploadToFolder(user: SessionUser, folderPerm?: Permission | null): boolean {
  if (user.role === 'super_admin') return true
  // edit permission on folder allows uploading documents
  if (folderPerm && hasPerm(folderPerm, 'edit')) return true
  if (user.role === 'dept_admin') return true
  return false
}

// ── Prisma Where Builder ──

/**
 * Build Prisma `where` clause for documents the user can READ.
 * Uses legacy ownerDept + audiences (folder permission check done at app layer since it requires walking folder tree).
 */
export function getVisibleDocuments(user: SessionUser): Record<string, unknown> {
  if (user.role === 'super_admin') return {}

  // Collect folder IDs the user has explicit access to
  const { getUserAccessibleFolderIds } = require('./folders')
  let allowedFolderIds: string[] = []
  try {
    allowedFolderIds = getUserAccessibleFolderIds(user)
  } catch { /* fallback: empty list means no folder access */ }

  const conditions: Record<string, unknown>[] = []

  if (user.departmentId) {
    conditions.push(
      { ownerDeptId: user.departmentId },
      { audiences: { some: { departmentId: user.departmentId } } },
    )
  }

  // Only include folder docs the user has explicit permission to access
  if (allowedFolderIds.length > 0) {
    conditions.push({ folderId: { in: allowedFolderIds } })
  }

  if (conditions.length === 0) {
    // No access at all — return a clause that matches nothing
    return { id: '__no_access__' }
  }

  return { OR: conditions }
}

export const buildDocumentWhere = getVisibleDocuments

// ── Admin Route Access ──

export function canAccessAdminRoute(user: SessionUser, pathname: string): boolean {
  if (user.role === 'super_admin') return true

  if (pathname.startsWith('/internal/admin/users') || pathname.startsWith('/api/users')) {
    return false
  }

  if (pathname.startsWith('/internal/policy-upload') || pathname === '/api/admin/policy-upload') {
    return user.companyName === '时胜' && user.departmentName === '品牌部'
  }

  if (pathname.startsWith('/internal/policy')) return true

  return true
}
