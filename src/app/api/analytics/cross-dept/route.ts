import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Cross-department access analysis
  const depts = await prisma.department.findMany({
    select: { id: true, name: true, slug: true, company: { select: { name: true } } },
  })

  // Build matrix: all depts in parallel
  const matrix = await Promise.all(depts.map(async dept => {
    const [ownedDocs, usersInDept] = await Promise.all([
      prisma.document.count({ where: { ownerDeptId: dept.id } }),
      prisma.user.findMany({ where: { departmentId: dept.id }, select: { id: true } }),
    ])
    const userIds = usersInDept.map(u => u.id)

    let crossDeptViews = 0
    if (userIds.length > 0) {
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId: { in: userIds }, action: 'view', documentId: { not: null } },
        select: { documentId: true },
        take: 500,
      })
      const docIds = Array.from(new Set(auditLogs.map(l => l.documentId).filter(Boolean)))
      if (docIds.length > 0) {
        crossDeptViews = await prisma.document.count({
          where: { id: { in: docIds as string[] }, ownerDeptId: { not: dept.id } },
        })
      }
    }

    // Total views on this dept's docs (all users)
    const totalViews = await prisma.auditLog.count({
      where: { action: 'view', document: { ownerDeptId: dept.id } },
    })

    let viewedByOthers = 0
    if (userIds.length > 0) {
      viewedByOthers = await prisma.auditLog.count({
        where: { action: 'view', document: { ownerDeptId: dept.id }, userId: { notIn: userIds } },
      })
    } else {
      viewedByOthers = totalViews // no internal users → all views are from others
    }

    return {
      department: dept.name,
      company: dept.company?.name || 'N/A',
      ownedDocs,
      crossDeptViews,
      viewedByOthers,
      totalViews,
      usersCount: userIds.length,
    }
  }))

  // Top viewed docs across departments
  const topDocs = await prisma.auditLog.groupBy({
    by: ['documentId'],
    where: { action: 'view', documentId: { not: null } },
    _count: { documentId: true },
    orderBy: { _count: { documentId: 'desc' } },
    take: 10,
  })

  const topDocIds = topDocs.map(g => g.documentId).filter(Boolean) as string[]
  const topDocDetails = topDocIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: topDocIds } },
        select: { id: true, title: true, ownerDept: { select: { name: true } } },
      })
    : []
  const topDocMap = new Map(topDocDetails.map(d => [d.id, d]))

  return NextResponse.json({
    matrix,
    topDocs: topDocs.map(g => ({
      id: g.documentId,
      title: topDocMap.get(g.documentId!)?.title || 'Unknown',
      department: topDocMap.get(g.documentId!)?.ownerDept?.name || 'Unknown',
      views: g._count.documentId,
    })),
    summary: {
      totalDepartments: depts.length,
      totalCrossDeptViews: matrix.reduce((s, m) => s + m.crossDeptViews, 0),
      mostConnectedDept: matrix.sort((a, b) => (b.crossDeptViews + b.viewedByOthers) - (a.crossDeptViews + a.viewedByOthers))[0]?.department || 'N/A',
    },
  })
}
