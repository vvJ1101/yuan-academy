import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = buildDocumentWhere(session)

  const [popularIds, deptDocs, recentAuditIds, riskDocs] = await Promise.all([
    // Popular by view count
    prisma.auditLog.groupBy({
      by: ['documentId'],
      where: { action: 'view', documentId: { not: null } },
      _count: { documentId: true },
      orderBy: { _count: { documentId: 'desc' } },
      take: 8,
    }),
    // Same department docs
    session.departmentId ? prisma.document.findMany({
      where: { ...where, ownerDeptId: session.departmentId },
      select: { id: true, title: true, slug: true, category: true, ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 5,
    }) : Promise.resolve([]),
    // Recently viewed by this user
    prisma.auditLog.findMany({
      where: { userId: session.id, action: 'view', documentId: { not: null } },
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { documentId: true },
    }),
    // Risk docs
    prisma.document.findMany({
      where: { ...where, OR: [{ riskLevel: 'high' }, { title: { contains: '风险' } }] },
      select: { id: true, title: true, slug: true, riskLevel: true, ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      take: 4,
    }),
  ])

  // Resolve popular
  const popIds = popularIds.map(g => g.documentId).filter(Boolean) as string[]
  const popDocs = popIds.length > 0 ? await prisma.document.findMany({
    where: { id: { in: popIds } },
    select: { id: true, title: true, slug: true, category: true, ownerDept: { select: { name: true } },
      audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
  }) : []
  const popMap = new Map(popDocs.map(d => [d.id, d]))
  const popular = popIds.map(id => popMap.get(id)).filter(Boolean)

  // AI-generated recommendation reasons
  const recentDocIds = recentAuditIds.map(a => a.documentId).filter(Boolean) as string[]
  const reasons: Record<string, string> = {}

  if (recentDocIds.length > 0) {
    const recentDocs = await prisma.document.findMany({
      where: { id: { in: recentDocIds.slice(0, 3) } },
      select: { id: true, title: true, category: true, ownerDept: { select: { name: true } } },
    })
    for (const d of recentDocs) {
      reasons[d.id] = `你最近查看过「${d.ownerDept?.name || ''}」的文档`
    }
  }
  for (const d of deptDocs.slice(0, 3)) {
    if (!reasons[d.id]) reasons[d.id] = `来自你所在部门「${d.ownerDept?.name || ''}」的相关文档`
  }
  for (const d of popular.slice(0, 3)) {
    if (d && !reasons[d.id]) reasons[d.id] = '全公司高频访问文档'
  }

  return NextResponse.json({
    popular: popular.slice(0, 5).map((d: any) => ({ ...d, reason: reasons[d?.id] || '热门文档' })),
    forYou: deptDocs.map((d: any) => ({ ...d, reason: reasons[d.id] || `归属${d.ownerDept?.name}` })),
    riskAlerts: riskDocs.map((d: any) => ({
      ...d, reason: d.riskLevel === 'high' ? '高风险文档，请关注' : '含风险提示内容',
    })),
  })
}
