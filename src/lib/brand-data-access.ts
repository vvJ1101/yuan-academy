import { prisma } from '@/lib/prisma'
import type { SessionClaims } from '@/lib/session'
import type { ContactView } from '@/types/brand-data'

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

function isMerchandisingDepartment(session: SessionClaims): boolean {
  return session.departmentName === '商品部'
}

function isMarketingDepartment(session: SessionClaims): boolean {
  return session.departmentName === '市场部'
}

export async function getContactView(session: SessionClaims): Promise<ContactView | null> {
  const permissions = await getPermissionSet(session)
  if (
    session.role === 'super_admin'
    || hasPermission(permissions, 'brandContact.viewFullFields')
    || isMerchandisingDepartment(session)
  ) {
    return 'full'
  }
  if (
    hasPermission(permissions, 'brandContact.viewMarketFields')
    || isMarketingDepartment(session)
  ) {
    return 'market'
  }
  return null
}

export async function canUploadContact(session: SessionClaims): Promise<boolean> {
  const permissions = await getPermissionSet(session)
  return session.role === 'super_admin'
    || hasPermission(permissions, 'brandContact.upload')
    || isMerchandisingDepartment(session)
}

export async function canExportContact(session: SessionClaims, view: ContactView): Promise<boolean> {
  const permissions = await getPermissionSet(session)
  if (session.role === 'super_admin') return true
  if (view === 'full') {
    return hasPermission(permissions, 'brandContact.exportFullFields') || isMerchandisingDepartment(session)
  }
  return hasPermission(permissions, 'brandContact.exportMarketFields') || isMarketingDepartment(session)
}
