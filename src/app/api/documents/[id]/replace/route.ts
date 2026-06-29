import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { canEditDocument } from '@/lib/permissions/documents'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 })

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, ownerDeptId: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canEditDocument(session, doc.ownerDeptId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const docDir = join(process.cwd(), 'public', 'uploads', 'documents', params.id)
  if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true })

  // Save new DOCX
  writeFileSync(join(docDir, 'original.docx'), buffer)

  // Re-parse
  const { parseDocx } = await import('@/lib/parser')
  const result = await parseDocx(buffer, params.id)
  const fullContent = result.markdown.substring(0, 100000)

  await prisma.document.update({
    where: { id: params.id },
    data: { fullContent, displayMode: 'full' },
  })

  return NextResponse.json({ ok: true, parseStats: result.stats, imageCount: result.imageCount })
}
