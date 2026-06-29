import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Unified permission: ownerDept OR audience includes user's department
  const docWhere = buildDocumentWhere(session)

  const [
    docCount, deptCount, companyCount,
    aiDocCount, faqCount, chatCount,
    recentDocs, popularDocIds, newEmployeeDocs,
  ] = await Promise.all([
    prisma.document.count({ where: docWhere }),
    prisma.department.count(),
    prisma.company.count(),
    // AI-parsed docs
    prisma.document.count({
      where: { ...docWhere, condensedContent: { not: '' } },
    }),
    prisma.faq.count(),
    prisma.chatLog.count(),
    // Recent docs
    prisma.document.findMany({
      where: docWhere,
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true, title: true, slug: true, category: true, updatedAt: true,
        ownerDept: { select: { name: true, slug: true } },
        audiences: { select: { department: { select: { slug: true } } }, take: 1 },
      },
    }),
    // Popular docs by view count
    prisma.auditLog.groupBy({
      by: ['documentId'],
      where: { action: 'view', documentId: { not: null } },
      _count: { documentId: true },
      orderBy: { _count: { documentId: 'desc' } },
      take: 6,
    }),
    // New employee docs
    prisma.document.findMany({
      where: {
        ...docWhere,
        OR: [
          { title: { contains: '入职' } },
          { title: { contains: '新人' } },
          { title: { contains: '培训' } },
          { title: { contains: '员工手册' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: {
        id: true, title: true, slug: true, category: true,
        ownerDept: { select: { name: true, slug: true } },
        audiences: { select: { department: { select: { slug: true } } }, take: 1 },
      },
    }),
  ])

  // Resolve popular doc details
  let popularDocs: any[] = []
  if (popularDocIds.length > 0) {
    const ids = popularDocIds.map((g: any) => g.documentId).filter(Boolean) as string[]
    const docs = await prisma.document.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, title: true, slug: true, category: true,
        ownerDept: { select: { name: true, slug: true } },
        audiences: { select: { department: { select: { slug: true } } }, take: 1 },
      },
    })
    // Preserve popularity order + view counts
    const viewCountMap = new Map(popularDocIds.map((g: any) => [g.documentId, g._count.documentId]))
    const docMap = new Map(docs.map(d => [d.id, d]))
    popularDocs = ids.map(id => {
      const doc = docMap.get(id)
      if (!doc) return null
      return { ...doc, viewCount: viewCountMap.get(id) || 0 }
    }).filter(Boolean)
  }

  // Count docs with Mermaid in condensed content
  const mermaidDocs = await prisma.document.findMany({
    where: { ...docWhere, condensedContent: { contains: 'mermaid' } },
    select: { id: true },
  })
  const mermaidCount = mermaidDocs.length

  // Knowledge coverage
  const knowledgeCoverage = docCount > 0 ? Math.round((aiDocCount / docCount) * 100) : 0

  return NextResponse.json({
    docCount,
    deptCount,
    companyCount,
    aiDocCount,
    faqCount,
    chatCount,
    mermaidCount,
    knowledgeCoverage,
    popularDocs: popularDocs.map((d: any) => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      category: d.category,
      department: d.ownerDept?.name || '',
      audienceSlug: d.audiences?.[0]?.department?.slug || d.ownerDept?.slug || '',
      viewCount: d.viewCount || 0,
    })),
    recentDocs: recentDocs.map(d => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      category: d.category,
      department: d.ownerDept?.name || '',
      audienceSlug: d.audiences?.[0]?.department.slug || d.ownerDept?.slug || '',
      updatedAt: d.updatedAt,
    })),
    newEmployeeDocs: newEmployeeDocs.map(d => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      category: d.category,
      department: d.ownerDept?.name || '',
      audienceSlug: d.audiences?.[0]?.department?.slug || d.ownerDept?.slug || '',
    })),
  })
}
