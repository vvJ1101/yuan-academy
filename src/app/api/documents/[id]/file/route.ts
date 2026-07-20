import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

import { NextRequest, NextResponse } from 'next/server'

import {
  buildFileResponseHeaders,
  parseByteRange,
  RangeNotSatisfiableError,
  resolveDocumentFileAccess,
} from '@/lib/document-file-access'
import {
  getOriginalFilePath,
  getPreviewFilePath,
  type DocumentFileType,
} from '@/lib/document-files'
import { logDocumentAccess } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { getDocumentPermission } from '@/lib/permissions/folders'
import { readVerifiedSession } from '@/lib/session'

const FILE_TYPES = new Set<DocumentFileType>(['pdf', 'ppt', 'pptx', 'xls', 'xlsx', 'docx'])

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers })
}

async function serveDocumentFile(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readVerifiedSession(req.headers.get('cookie'))
  if (!session) return jsonError('请先登录', 401)

  const document = await prisma.document.findUnique({
    where: { id: (await params).id },
    select: { id: true, originalFileName: true, fileType: true, mimeType: true },
  })
  if (!document) return jsonError('文档不存在', 404)

  const permission = await getDocumentPermission(session, document.id)
  const variant = req.nextUrl.searchParams.get('variant') ?? 'preview'
  const disposition = req.nextUrl.searchParams.get('disposition') ?? 'inline'
  const purpose = req.nextUrl.searchParams.get('purpose') ?? 'read'

  if (disposition !== 'inline' && disposition !== 'attachment') return jsonError('文件打开方式无效', 400)
  if (purpose !== 'read' && purpose !== 'print') return jsonError('文件用途无效', 400)
  if (!FILE_TYPES.has(document.fileType as DocumentFileType)) return jsonError('文档文件类型无效', 404)

  const fileType = document.fileType as DocumentFileType
  const access = resolveDocumentFileAccess({ permission, variant, disposition, purpose, fileType })
  if (!access.allowed) {
    return jsonError(access.error ?? '没有权限执行此操作', access.status ?? 403)
  }

  const filePath = access.source === 'preview'
    ? getPreviewFilePath(document.id)
    : getOriginalFilePath(document.id, fileType)
  let fileStat
  try {
    fileStat = await stat(filePath)
    if (!fileStat.isFile()) return jsonError('文件不存在', 404)
  } catch {
    return jsonError('文件不存在', 404)
  }

  let range
  try {
    range = parseByteRange(req.headers.get('range'), fileStat.size)
  } catch (error) {
    if (error instanceof RangeNotSatisfiableError) {
      return jsonError('请求的文件范围无效', 416, { 'Content-Range': `bytes */${fileStat.size}` })
    }
    throw error
  }

  const isPreviewPdf = access.source === 'preview'
  const mimeType = isPreviewPdf ? 'application/pdf' : document.mimeType
  const fileName = isPreviewPdf
    ? `${document.originalFileName.replace(/\.[^.]+$/, '') || document.id}.pdf`
    : (document.originalFileName || `${document.id}.${fileType}`)
  const headers = buildFileResponseHeaders({
    mimeType,
    fileName,
    disposition,
    size: fileStat.size,
    range,
  })

  const action = purpose === 'print' ? 'print' : disposition === 'attachment' || variant === 'original' ? 'download' : 'preview'
  await logDocumentAccess(session.id, document.id, action)

  const stream = createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined)
  return new NextResponse(stream as unknown as BodyInit, { status: range ? 206 : 200, headers })
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return serveDocumentFile(req, context)
}
