import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { buildDocumentWhere } from '@/lib/permissions/documents'
import { getFolderPermission, getDocumentPermission, type Permission } from '@/lib/permissions/folders'
import { statSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const owner = searchParams.get('owner')
  const audience = searchParams.get('audience')
  const category = searchParams.get('category')
  const slug = searchParams.get('slug')

  const conditions: Record<string, unknown>[] = []
  if (category && category !== 'All') conditions.push({ category })
  if (owner && owner !== 'All') conditions.push({ ownerDept: { slug: owner } })
  if (audience && audience !== 'All') {
    conditions.push({
      audiences: { some: { department: { slug: audience } } },
    })
  }
  if (slug) conditions.push({ slug })

  // Unified permission: ownerDept OR audience includes user's department
  conditions.push(buildDocumentWhere(session))

  const where: Record<string, unknown> = {}
  if (conditions.length > 0) where.AND = conditions

  const docs = await prisma.document.findMany({
    where,
    select: {
      id: true, title: true, slug: true, category: true, updatedAt: true,
      ownerDeptId: true, folderId: true,
      condensedContent: true, fullContent: true,
      ownerDept: { select: { name: true, slug: true } },
      folder: { select: { id: true, name: true } },
      audiences: { include: { department: { select: { name: true, slug: true } } } },
      author: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Add summary + userPermission + fileSize (async-aware)
  const withMeta = await Promise.all(docs.map(async doc => {
    let summary = ''
    if (doc.condensedContent) {
      const match = doc.condensedContent.match(/^> (.+)/m)
      if (match) summary = match[1].trim()
    }
    if (!summary && doc.fullContent) {
      summary = doc.fullContent.replace(/[#*>\n]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80)
    }
    // Compute user permission using the full permission engine
    let userPermission: string | null = null
    if (session.role === 'super_admin') {
      userPermission = 'admin'
    } else {
      try {
        const docPerm = await getDocumentPermission(session, doc.id)
        userPermission = docPerm || null
      } catch { /* fallback below */ }
      // Fallback: legacy ownerDept + audience
      if (!userPermission) {
        if (doc.ownerDeptId === session.departmentId) {
          userPermission = session.role === 'dept_admin' ? 'admin' : 'edit'
        } else if (doc.audiences?.some((a: any) => a.departmentId === session.departmentId)) {
          userPermission = 'view'
        }
      }
    }
    // Read actual file size from disk
    let fileSize: number | null = null
    try {
      const docxPath = join(process.cwd(), 'public', 'uploads', 'documents', doc.id, 'original.docx')
      fileSize = statSync(docxPath).size
    } catch { fileSize = null }
    const { condensedContent, fullContent, ...rest } = doc
    return { ...rest, summary, userPermission, fileSize, hasAiSummary: !!condensedContent }
  }))

  return NextResponse.json(withMeta)
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string
  const ownerDeptId = (formData.get('departmentId') as string) || session?.departmentId || null
  const category = (formData.get('category') as string) || 'reference'
  const authorId = session?.id || (formData.get('authorId') as string) || 'unknown'

  if (!file || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { parseDocx } = await import('@/lib/parser')
  const buffer = Buffer.from(await file.arrayBuffer())

  const doc = await prisma.document.create({
    data: {
      title,
      slug: title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200),
      fullContent: '',
      category,
      ownerDeptId: ownerDeptId || undefined,
      authorId,
      visibility: 'department',
      folderId: (formData.get('folderId') as string) || null,
    },
  })

  // Save original DOCX for download
  const docDir = join(process.cwd(), 'public', 'uploads', 'documents', doc.id)
  if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true })
  try { writeFileSync(join(docDir, 'original.docx'), buffer) } catch {}

  const result = await parseDocx(buffer, doc.id)
  const fullContent = result.markdown.substring(0, 100000)

  // Handle audience department assignments
  const audienceIds = (formData.get('audienceIds') as string)?.split(',').filter(Boolean) || []
  if (audienceIds.length > 0) {
    await Promise.all(audienceIds.map((deptId: string) =>
      prisma.documentAudience.create({ data: { documentId: doc.id, departmentId: deptId } })
        .catch(() => {}) // ignore duplicates
    ))
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      fullContent: fullContent,
      displayMode: 'full',
    },
  })

  return NextResponse.json({
    ...updated,
    parseStats: result.stats,
    imageCount: result.imageCount,
    parseWarnings: result.warnings,
  }, { status: 201 })
}
