import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookies } from '@/lib/auth'
import { canReadDocument } from '@/lib/permissions/documents'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      ownerDept: { select: { name: true, slug: true } },
      audiences: { include: { department: { select: { name: true, slug: true } } } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canReadDocument(session, doc)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse graph edges from JSON fields
  let prerequisites: string[] = []
  let relatedDocs: string[] = []
  try { prerequisites = JSON.parse(doc.prerequisites || '[]') } catch {}
  try { relatedDocs = JSON.parse(doc.relatedDocs || '[]') } catch {}

  // Find docs with same processStage
  const sameStage = doc.processStage
    ? await prisma.document.findMany({
        where: { processStage: doc.processStage, id: { not: doc.id } },
        select: { id: true, title: true, slug: true, processStage: true,
          ownerDept: { select: { name: true } },
          audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
        take: 5,
      })
    : []

  // Find docs that have this doc as prerequisite
  const dependentDocs = await prisma.document.findMany({
    where: { prerequisites: { contains: doc.id } },
    select: { id: true, title: true, slug: true,
      ownerDept: { select: { name: true } },
      audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
    take: 5,
  })

  // Resolve prerequisite and related doc details
  const allEdgeIds = [...prerequisites, ...relatedDocs]
  const edgeDocs = allEdgeIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: allEdgeIds } },
        select: { id: true, title: true, slug: true, processStage: true, riskLevel: true,
          ownerDept: { select: { name: true } },
          audiences: { include: { department: { select: { slug: true } } }, take: 1 } },
      })
    : []

  const edgeMap = new Map(edgeDocs.map(d => [d.id, d]))

  return NextResponse.json({
    node: {
      id: doc.id, title: doc.title, documentType: doc.documentType,
      processStage: doc.processStage, riskLevel: doc.riskLevel,
      ownerDept: doc.ownerDept?.name || '',
    },
    edges: {
      prerequisites: prerequisites.map(id => edgeMap.get(id)).filter(Boolean),
      relatedDocs: relatedDocs.map(id => edgeMap.get(id)).filter(Boolean),
      dependents: dependentDocs,
      sameStage: sameStage.filter(d => canReadDocument(session, d)),
    },
  })
}
