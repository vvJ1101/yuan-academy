import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = buildDocumentWhere(session)
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')

  const stageFilter = stage ? { processStage: stage } : {}

  const docs = await prisma.document.findMany({
    where: {
      ...where,
      ...stageFilter,
      OR: [
        { category: 'sop' },
        { documentType: 'SOP' },
        { title: { contains: '流程' } },
        { title: { contains: 'SOP' } },
      ],
    },
    select: {
      id: true, title: true, slug: true, category: true,
      documentType: true, processStage: true, riskLevel: true,
      ownerDept: { select: { name: true, slug: true } },
      audiences: { include: { department: { select: { slug: true } } }, take: 1 },
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const byStage: Record<string, typeof docs> = {}
  for (const d of docs) {
    const key = d.processStage || d.documentType || 'other'
    if (!byStage[key]) byStage[key] = []
    byStage[key].push(d)
  }

  return NextResponse.json({ docs, byStage, total: docs.length })
}
