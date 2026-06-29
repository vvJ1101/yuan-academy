/**
 * Folder Permission Engine v3
 *
 * Permission levels: view < edit < delete < admin
 * Rules: FolderPermission → tree inheritance
 * Match priority: user > role > department > company
 *
 * Backward compat: old "download" → "view", old "upload" → "edit"
 */

import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth'

export type Permission = 'view' | 'edit' | 'delete' | 'admin'

const PERM_LEVEL: Record<Permission, number> = {
  view: 1, edit: 2, delete: 3, admin: 4,
}

/** Map legacy permission values to current 4-level system */
function normalizePerm(p: string | null): Permission | null {
  if (!p) return null
  if (p === 'download' || p === 'upload') return 'view'
  if (p === 'view' || p === 'edit' || p === 'delete' || p === 'admin') return p
  return null
}

export function hasPerm(userLevel: Permission | null, required: Permission): boolean {
  if (!userLevel) return false
  return PERM_LEVEL[userLevel] >= PERM_LEVEL[required]
}

// ── Cache ──

let permCache: { rules: { companyId: string | null; departmentId: string | null; userId: string | null; role: string | null; permission: string }[]; folderId: string; inheritPermissions: boolean; parentId: string | null }[] | null = null
let permCacheTime = 0
const CACHE_TTL = 10_000

async function getFolderPermRules() {
  const now = Date.now()
  if (permCache && now - permCacheTime < CACHE_TTL) return permCache
  const folders = await prisma.folder.findMany({
    select: {
      id: true, parentId: true, inheritPermissions: true,
      permissions: { select: { companyId: true, departmentId: true, userId: true, role: true, permission: true } },
    },
  })
  permCache = folders.map(f => ({
    folderId: f.id, parentId: f.parentId, inheritPermissions: f.inheritPermissions,
    rules: f.permissions as any[],
  }))
  permCacheTime = now
  return permCache
}

export function clearPermCache() { permCache = null; permCacheTime = 0 }

// ── Match rule against user ──

function matchRule(rule: { companyId?: string | null; departmentId?: string | null; userId?: string | null; role?: string | null; permission: string }, user: SessionUser): Permission | null {
  if (rule.userId && rule.userId === user.id) return normalizePerm(rule.permission)
  if (rule.role && rule.role === user.role) return normalizePerm(rule.permission)
  if (rule.departmentId && rule.departmentId === user.departmentId) return normalizePerm(rule.permission)
  if (rule.companyId && rule.companyId === user.companyId) return normalizePerm(rule.permission)
  return null
}

// ── Folder permission ──

export async function getFolderPermission(user: SessionUser, folderId: string): Promise<Permission | null> {
  if (user.role === 'super_admin') return 'admin'
  const allFolders = await getFolderPermRules()
  const folderMap = new Map(allFolders.map(f => [f.folderId, f]))
  let best: Permission | null = null
  let currentId: string | null = folderId
  while (currentId) {
    const f = folderMap.get(currentId)
    if (!f) break
    for (const rule of f.rules) {
      const m = matchRule(rule, user)
      if (m && (!best || PERM_LEVEL[m] > PERM_LEVEL[best])) best = m
    }
    if (!f.inheritPermissions) break
    currentId = f.parentId
  }
  return best
}

export async function getUserAccessibleFolderIds(user: SessionUser): Promise<string[]> {
  if (user.role === 'super_admin') {
    const folders = await prisma.folder.findMany({ select: { id: true } })
    return folders.map(f => f.id)
  }
  const allFolders = await getFolderPermRules()
  const folderMap = new Map(allFolders.map(f => [f.folderId, f]))
  const visible = new Set<string>()
  for (const f of allFolders) {
    let currentId: string | null = f.folderId
    while (currentId) {
      const folder = folderMap.get(currentId)
      if (!folder) break
      for (const rule of folder.rules) {
        if (matchRule(rule, user)) { visible.add(f.folderId); break }
      }
      if (visible.has(f.folderId)) break
      if (!folder.inheritPermissions) break
      currentId = folder.parentId
    }
  }
  return Array.from(visible)
}

// ── Document permission ──

export async function getDocumentPermission(user: SessionUser, docId: string): Promise<Permission | null> {
  if (user.role === 'super_admin') return 'admin'
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      folderId: true, ownerDeptId: true, overridePermissions: true,
      audiences: { select: { departmentId: true } },
      documentPermissions: {
        select: { companyId: true, departmentId: true, userId: true, role: true, permission: true },
      },
    },
  })
  if (!doc) return null
  if (doc.overridePermissions) {
    let best: Permission | null = null
    for (const p of doc.documentPermissions) {
      const m = matchRule({ ...p, permission: p.permission }, user)
      if (m && (!best || PERM_LEVEL[m] > PERM_LEVEL[best])) best = m
    }
    return best
  }
  if (doc.folderId) {
    const fp = await getFolderPermission(user, doc.folderId)
    if (fp) return fp
  }
  if (doc.ownerDeptId && user.departmentId === doc.ownerDeptId) return user.role === 'dept_admin' ? 'admin' : 'edit'
  if (user.departmentId && doc.audiences.some(a => a.departmentId === user.departmentId)) return 'view'
  return null
}
