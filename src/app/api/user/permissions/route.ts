import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })

  // Get user's roles
  const userRoles = await prisma.sysUserRole.findMany({
    where: { userId: session.id },
    include: {
      role: {
        include: {
          menus: { include: { menu: true } }
        }
      }
    }
  })

  // Collect all permission strings
  const perms = new Set<string>()
  const menuIds = new Set<string>()
  for (const ur of userRoles) {
    for (const rm of ur.role.menus) {
      menuIds.add(rm.menuId)
      if (rm.menu.permission) perms.add(rm.menu.permission)
    }
  }

  return NextResponse.json({
    code: 0,
    data: {
      permissions: Array.from(perms),
      menuIds: Array.from(menuIds),
      roles: userRoles.map(ur => ur.roleId),
    }
  })
}
