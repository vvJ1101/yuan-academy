import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = buildDocumentWhere(session)

  // Risk detection patterns:
  // 1. Documents with riskLevel = 'high'
  // 2. Documents with no condensedContent (not AI-parsed)
  // 3. Documents containing risk keywords in title/fullContent
  // 4. Recently updated documents (may need re-review)

  const [highRiskDocs, unparsedDocs, riskKeywordDocs, recentUpdates] = await Promise.all([
    prisma.document.findMany({
      where: { ...where, riskLevel: 'high' },
      select: { id: true, title: true, slug: true, riskLevel: true, updatedAt: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      take: 10,
    }),
    prisma.document.findMany({
      where: { ...where, condensedContent: '' },
      select: { id: true, title: true, slug: true, updatedAt: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      take: 5,
    }),
    prisma.document.findMany({
      where: {
        ...where,
        OR: [
          { title: { contains: '风险' } }, { title: { contains: '禁止' } },
          { title: { contains: '警告' } }, { title: { contains: '注意' } },
          { fullContent: { contains: '风险提示' } },
        ],
      },
      select: { id: true, title: true, slug: true, updatedAt: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      take: 5,
    }),
    prisma.document.findMany({
      where: { ...where, updatedAt: { gte: new Date(Date.now() - 7*24*60*60*1000) } },
      select: { id: true, title: true, slug: true, updatedAt: true,
        ownerDept: { select: { name: true } },
        audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      orderBy: { updatedAt: 'desc' }, take: 5,
    }),
  ])

  return NextResponse.json({
    alerts: [
      ...(highRiskDocs.length > 0 ? [{ type: 'high_risk' as const, message: `${highRiskDocs.length} 篇高风险文档需关注`, count: highRiskDocs.length, docs: highRiskDocs }] : []),
      ...(unparsedDocs.length > 0 ? [{ type: 'unparsed' as const, message: `${unparsedDocs.length} 篇文档尚未 AI 解析`, count: unparsedDocs.length, docs: unparsedDocs }] : []),
      ...(riskKeywordDocs.length > 0 ? [{ type: 'risk_keyword' as const, message: `${riskKeywordDocs.length} 篇文档含风险关键词`, count: riskKeywordDocs.length, docs: riskKeywordDocs }] : []),
    ],
    recentUpdates,
    summary: {
      totalAlerts: highRiskDocs.length + unparsedDocs.length + riskKeywordDocs.length,
      needsAttention: highRiskDocs.length + unparsedDocs.length,
    },
  })
}
