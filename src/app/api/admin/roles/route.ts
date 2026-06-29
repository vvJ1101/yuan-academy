import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/roles — list with pagination + search
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get('size') || '20')))
  const name = searchParams.get('name') || ''

  const where = name ? { name: { contains: name } } : {}
  const [total, rows] = await Promise.all([
    prisma.sysRole.count({ where }),
    prisma.sysRole.findMany({
      where, skip: (page - 1) * size, take: size,
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const list = rows.map(r => ({
    id: r.id, name: r.name, code: r.code, description: r.description || '',
    dataScope: ['ALL','SELF_AND_CHILDREN','SELF','PERSONAL','CUSTOM'][r.dataScope - 1] || 'SELF_AND_CHILDREN',
    createTime: r.createdAt.toISOString().replace('T', ' ').slice(0, 19),
    status: r.status === 1 ? 'active' as const : 'disabled' as const,
    userCount: r._count.users,
  }))

  return NextResponse.json({ code: 0, data: { list, total } })
}

// POST /api/admin/roles — create role
export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session?.id || session.role !== 'super_admin') {
    return NextResponse.json({ code: 401, message: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  if (!body.name || !body.code) {
    return NextResponse.json({ code: 400, message: '名称和标识不能为空' }, { status: 400 })
  }
  const exists = await prisma.sysRole.findUnique({ where: { code: body.code } })
  if (exists) {
    return NextResponse.json({ code: 400, message: '角色标识已存在' }, { status: 400 })
  }
  await prisma.sysRole.create({
    data: { name: body.name, code: body.code, description: body.description || '', status: body.status === 'disabled' ? 0 : 1 },
  })
  prisma.auditLog.create({ data: { userId: session!.id, action: "role:create" } }).catch(() => {})
  return NextResponse.json({ code: 0, message: '创建成功' })

}
