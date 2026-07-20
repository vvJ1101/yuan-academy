import { NextRequest, NextResponse } from 'next/server'
import { access } from 'node:fs/promises'
import { getSessionFromCookies, prisma } from '@/lib/auth'
import { processDocumentFile } from '@/lib/document-processor'
import { getOriginalFilePath, validateUploadFile } from '@/lib/document-files'
import { logUpload } from '@/lib/audit'
import { buildDocumentWhere, canUploadToFolder } from '@/lib/permissions/documents'
import { getFolderPermission, getFolderPermissionsForDocuments } from '@/lib/permissions/folders'
import { resolveDocumentPermission } from '@/lib/permissions/document-resolution'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conditions: Record<string, unknown>[] = []
  const owner = searchParams.get('owner')
  const audience = searchParams.get('audience')
  const category = searchParams.get('category')
  const slug = searchParams.get('slug')
  if (category && category !== 'All') conditions.push({ category })
  if (owner && owner !== 'All') conditions.push({ ownerDept: { slug: owner } })
  if (audience && audience !== 'All') conditions.push({ audiences: { some: { department: { slug: audience } } } })
  if (slug) conditions.push({ slug })
  conditions.push(await buildDocumentWhere(session))

  const docs = await prisma.document.findMany({
    where: { AND: conditions },
    select: {
      id: true, title: true, slug: true, category: true, updatedAt: true,
      ownerDeptId: true, folderId: true, condensedContent: true, fullContent: true,
      overridePermissions: true,
      documentPermissions: { select: { companyId: true, departmentId: true, userId: true, role: true, permission: true } },
      originalFileName: true, fileType: true, fileSize: true, processingStatus: true, processingError: true,
      ownerDept: { select: { name: true, slug: true } },
      folder: { select: { id: true, name: true } },
      audiences: { include: { department: { select: { name: true, slug: true } } } },
      author: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const folderPermissions = await getFolderPermissionsForDocuments(session, docs.map(doc => doc.folderId))
  const withMeta = docs.map(doc => {
    let summary = doc.condensedContent.match(/^> (.+)/m)?.[1]?.trim() ?? ''
    if (!summary && doc.fullContent) summary = doc.fullContent.replace(/[#*>\n]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80)
    const userPermission = resolveDocumentPermission(
      session,
      doc,
      doc.folderId ? folderPermissions.get(doc.folderId) ?? null : null,
    )
    const { condensedContent, fullContent, documentPermissions: _documentPermissions, overridePermissions: _overridePermissions, ...rest } = doc
    return { ...rest, summary, userPermission, hasAiSummary: Boolean(condensedContent) }
  })

  return NextResponse.json(withMeta)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: '上传数据格式无效' }, { status: 400 })
  }
  const file = formData.get('file')
  const title = String(formData.get('title') || '').trim()
  const folderId = String(formData.get('folderId') || '').trim() || null
  if (!(file instanceof File) || !title) return NextResponse.json({ error: '请选择文件并填写标题' }, { status: 400 })

  if (folderId && !await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true } })) {
    return NextResponse.json({ error: '目标文件夹不存在' }, { status: 404 })
  }
  const folderPermission = folderId ? await getFolderPermission(session, folderId) : null
  if (!canUploadToFolder(session, folderPermission)) {
    return NextResponse.json({ error: '你没有向该文件夹上传的权限' }, { status: 403 })
  }

  let upload
  try { upload = validateUploadFile(file) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '文件校验失败' }, { status: 400 })
  }

  const audienceIds = String(formData.get('audienceIds') || '').split(',').map(id => id.trim()).filter(Boolean)
  const buffer = Buffer.from(await file.arrayBuffer())
  let documentId: string | null = null
  try {
    const doc = await prisma.document.create({
      data: {
        title,
        slug: title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200),
        fullContent: '',
        category: String(formData.get('category') || 'reference'),
        ownerDeptId: String(formData.get('departmentId') || session.departmentId || '') || undefined,
        authorId: session.id,
        visibility: 'department',
        folderId,
        originalFileName: upload.originalFileName,
        fileType: upload.fileType,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        processingStatus: 'processing',
        audiences: audienceIds.length ? { create: audienceIds.map(departmentId => ({ departmentId })) } : undefined,
      },
    })
    documentId = doc.id
    const processed = await processDocumentFile({ documentId: doc.id, buffer, upload })
    if (processed.originalStored === false) {
      await prisma.document.delete({ where: { id: doc.id } })
      return NextResponse.json({ error: '原文件保存失败，未创建文档' }, { status: 500 })
    }
    await logUpload(session.id, doc.id)

    let fullContent = `> 该文档为 ${upload.fileType.toUpperCase()} 文件，请使用在线阅读器查看。`
    let displayMode = upload.fileType === 'pdf' || upload.fileType === 'ppt' || upload.fileType === 'pptx' ? 'pdf' : 'full'
    let parseStats: unknown
    if (upload.fileType === 'docx') {
      const { parseDocx } = await import('@/lib/parser')
      const parsed = await parseDocx(buffer, doc.id)
      fullContent = parsed.markdown.substring(0, 100000)
      displayMode = 'full'
      parseStats = parsed.stats
    }
    const updated = await prisma.document.update({ where: { id: doc.id }, data: { fullContent, content: fullContent, displayMode } })
    const { previewPath: _previewPath, sourcePath: _sourcePath, ...safeDocument } = updated
    return NextResponse.json({ ...safeDocument, processing: processed, parseStats }, { status: 201 })
  } catch (error) {
    if (documentId) {
      let originalStored = true
      try { await access(getOriginalFilePath(documentId, upload.fileType)) } catch { originalStored = false }
      if (!originalStored) {
        await prisma.document.delete({ where: { id: documentId } }).catch(() => undefined)
      } else {
        await prisma.document.update({
          where: { id: documentId },
          data: { processingStatus: 'failed', processingError: '文件后续处理失败，原文件已安全保存' },
        }).catch(() => undefined)
      }
    }
    console.error('[DocumentUpload] 上传处理失败')
    return NextResponse.json({ error: '文档上传失败，请稍后重试' }, { status: 500 })
  }
}
