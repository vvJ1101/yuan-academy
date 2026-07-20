import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const routeParams = await params
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  await prisma.sysUserRole.deleteMany({ where: { roleId: routeParams.id, userId: routeParams.userId } })
  return NextResponse.json({ code: 0, message: '已移除用户' })
}
