import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id) return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const size = Math.min(100, parseInt(searchParams.get('size') || '20'))
  const [total, rows] = await Promise.all([
    prisma.sysUserRole.count({ where: { roleId: params.id } }),
    prisma.sysUserRole.findMany({
      where: { roleId: params.id },
      skip: (page - 1) * size, take: size,
      include: { user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } } },
      orderBy: { roleId: 'asc' },
    }),
  ])
  const list = rows.map(r => ({
    id: r.user.id, name: r.user.name, email: r.user.email,
    department: r.user.department?.name || '', addedAt: '',
  }))
  return NextResponse.json({ code: 0, data: { list, total } })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const userIds: string[] = body.userIds || []
  for (const userId of userIds) {
    await prisma.sysUserRole.upsert({
      where: { userId_roleId: { userId, roleId: params.id } },
      create: { userId, roleId: params.id },
      update: {},
    })
  }
  return NextResponse.json({ code: 0, message: `已添加 ${userIds.length} 名用户` })
}
