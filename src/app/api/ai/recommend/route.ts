import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = buildDocumentWhere(session)

  // Recommend based on:
  // 1. Popular docs (most viewed via AuditLog)
  // 2. Same department as user
  // 3. Docs marked as training materials
  // 4. New employee onboarding docs

  const [popularIds, sameDept, trainingDocs, onboardingDocs] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['documentId'],
      where: { action: 'view', documentId: { not: null } },
      _count: { documentId: true },
      orderBy: { _count: { documentId: 'desc' } },
      take: 8,
    }).catch(() => []),
    (session.departmentId ? prisma.document.findMany({
      where: { ...where, ownerDeptId: session.departmentId },
      select: { id: true, title: true, slug: true, category: true, documentType: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 5,
    }) : Promise.resolve([])).catch(() => []),
    prisma.document.findMany({
      where: { ...where, OR: [{ category: 'training' }, { documentType: 'training' }] },
      select: { id: true, title: true, slug: true, category: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 5,
    }).catch(() => []),
    prisma.document.findMany({
      where: { ...where, OR: [{ title: { contains: '入职' } }, { title: { contains: '新人' } }, { title: { contains: '培训' } }] },
      select: { id: true, title: true, slug: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 4,
    }).catch(() => []),
  ])

  // Resolve popular docs
  let popularDocs: any[] = []
  if (popularIds.length > 0) {
    const ids = popularIds.map(g => g.documentId).filter(Boolean) as string[]
    const docs = await prisma.document.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, slug: true, category: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
    })
    const docMap = new Map(docs.map(d => [d.id, d]))
    popularDocs = ids.map(id => docMap.get(id)).filter(Boolean) as any[]
  }

  // Build learning path
  const learningPath = [
    ...onboardingDocs.map(d => ({ ...d, reason: '新员工入职必读' })),
    ...trainingDocs.filter(d => !onboardingDocs.find(o => o.id === d.id)).map(d => ({ ...d, reason: '培训资料' })),
    ...sameDept.filter(d => !onboardingDocs.find(o => o.id === d.id) && !trainingDocs.find(t => t.id === d.id)).map(d => ({ ...d, reason: '所属部门文档' })),
  ].slice(0, 8)

  return NextResponse.json({
    popular: popularDocs.slice(0, 4),
    learningPath,
    byDepartment: sameDept,
    training: trainingDocs,
    onboarding: onboardingDocs,
  })
}
