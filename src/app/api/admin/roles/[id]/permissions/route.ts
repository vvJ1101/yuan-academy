import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.sysRoleMenu.findMany({ where: { roleId: params.id }, select: { menuId: true } })
  return NextResponse.json({ code: 0, data: rows.map(r => r.menuId) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const menuIds: string[] = body.permissionIds || body.menuIds || []
  // 记录审计日志（必须在 return 之前）
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:permissions" } }).catch(() => {})
  await prisma.$transaction([
    prisma.sysRoleMenu.deleteMany({ where: { roleId: params.id } }),
    ...menuIds.map(menuId => prisma.sysRoleMenu.create({ data: { roleId: params.id, menuId } })),
  ])
  return NextResponse.json({ code: 0, message: '权限分配成功' })

}
