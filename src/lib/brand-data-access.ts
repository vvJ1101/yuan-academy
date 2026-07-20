import type { SessionClaims } from '@/lib/session'
import type { ContactView } from '@/types/brand-data'
import { prisma } from './prisma'

async function getPermissionSet(session: SessionClaims): Promise<Set<string>> {
  const permissions = new Set<string>()
  const inlinePermissions = (session as SessionClaims & { permissions?: string[] }).permissions
  if (Array.isArray(inlinePermissions)) {
    for (const permission of inlinePermissions) permissions.add(permission)
  }

  try {
    const roles = await prisma.sysUserRole.findMany({
      where: { userId: session.id },
      include: { role: { include: { menus: { include: { menu: true } } } } },
    })
    for (const userRole of roles) {
      for (const roleMenu of userRole.role.menus) {
        if (roleMenu.menu.permission) permissions.add(roleMenu.menu.permission)
      }
    }
  } catch {
    // Permission lookup failure falls back to role/department defaults below.
  }

  return permissions
}

function hasPermission(permissions: Set<string>, permission: string): boolean {
  return permissions.has('*') || permissions.has(permission)
}

export function getContactViewFromPermissions(
  permissions: Iterable<string>,
  role: string,
): ContactView | null {
  const permissionSet = new Set(permissions)
  if (
    role === 'super_admin'
    || hasPermission(permissionSet, 'brandContact.viewFullFields')
  ) {
    return 'full'
  }
  if (hasPermission(permissionSet, 'brandContact.viewMarketFields')) {
    return 'market'
  }
  return null
}

export function canUploadContactFromPermissions(
  permissions: Iterable<string>,
  role: string,
): boolean {
  const permissionSet = new Set(permissions)
  return role === 'super_admin' || hasPermission(permissionSet, 'brandContact.upload')
}

export function canEditContactFromPermissions(
  permissions: Iterable<string>,
  role: string,
): boolean {
  const permissionSet = new Set(permissions)
  return role === 'super_admin' || hasPermission(permissionSet, 'brandContact.edit')
}

export function canExportContactFromPermissions(
  permissions: Iterable<string>,
  role: string,
  view: ContactView,
): boolean {
  const permissionSet = new Set(permissions)
  if (role === 'super_admin') return true
  if (view === 'full') return hasPermission(permissionSet, 'brandContact.exportFullFields')
  return hasPermission(permissionSet, 'brandContact.exportMarketFields')
}

export async function getContactView(session: SessionClaims): Promise<ContactView | null> {
  const permissions = await getPermissionSet(session)
  return getContactViewFromPermissions(permissions, session.role)
}

export async function canUploadContact(session: SessionClaims): Promise<boolean> {
  const permissions = await getPermissionSet(session)
  return canUploadContactFromPermissions(permissions, session.role)
}

export async function canEditContact(session: SessionClaims): Promise<boolean> {
  const permissions = await getPermissionSet(session)
  return canEditContactFromPermissions(permissions, session.role)
}

export async function canExportContact(session: SessionClaims, view: ContactView): Promise<boolean> {
  const permissions = await getPermissionSet(session)
  return canExportContactFromPermissions(permissions, session.role, view)
}
