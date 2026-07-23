import type { DocumentFileType } from './document-files'

export type DocumentPermission = 'view' | 'edit' | 'delete' | 'admin'
export type DocumentFileVariant = 'preview' | 'original'
export type DocumentFilePurpose = 'read' | 'print'
export type DocumentFileDisposition = 'inline' | 'attachment'

export interface ByteRange {
  start: number
  end: number
}

const MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const DOWNLOAD_PERMISSIONS = new Set<DocumentPermission>(['edit', 'delete', 'admin'])

export class RangeNotSatisfiableError extends Error {
  constructor() {
    super('请求的文件范围无效')
    this.name = 'RangeNotSatisfiableError'
  }
}

export function parseByteRange(rangeHeader: string | null, size: number): ByteRange | null {
  if (!rangeHeader) return null
  if (!Number.isSafeInteger(size) || size <= 0 || !rangeHeader.startsWith('bytes=') || rangeHeader.includes(',')) {
    throw new RangeNotSatisfiableError()
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
  if (!match || (!match[1] && !match[2])) throw new RangeNotSatisfiableError()

  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) throw new RangeNotSatisfiableError()
    return { start: Math.max(0, size - suffixLength), end: size - 1 }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) {
    throw new RangeNotSatisfiableError()
  }
  return { start, end: Math.min(requestedEnd, size - 1) }
}

export function buildFileResponseHeaders(input: {
  mimeType: string
  fileName: string
  disposition: DocumentFileDisposition
  size: number
  range?: ByteRange | null
}): Record<string, string> {
  const length = input.range ? input.range.end - input.range.start + 1 : input.size
  const headers: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `${input.disposition}; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
    'Content-Length': String(length),
    'Content-Type': MIME_TYPES.has(input.mimeType) ? input.mimeType : 'application/octet-stream',
  }
  if (input.range) headers['Content-Range'] = `bytes ${input.range.start}-${input.range.end}/${input.size}`
  return headers
}

type AccessResult =
  | { allowed: true; source: DocumentFileVariant }
  | { allowed: false; status?: 400 | 403 | 404; error?: string }

export function resolveDocumentFileAccess(input: {
  permission: DocumentPermission | null
  variant: string
  purpose?: string
  disposition?: string
  fileType?: DocumentFileType
  fileExists?: boolean
}): AccessResult {
  if (input.variant !== 'preview' && input.variant !== 'original') {
    return { allowed: false, status: 400, error: '文件版本无效' }
  }

  const needsEdit = input.variant === 'original' || input.purpose === 'print' || input.disposition === 'attachment'
  const hasAccess = needsEdit
    ? input.permission !== null && DOWNLOAD_PERMISSIONS.has(input.permission)
    : input.permission !== null
  if (!hasAccess) return { allowed: false }
  if (input.fileExists === false) return { allowed: false, status: 404, error: '文件不存在' }

  const excelPreview = input.variant === 'preview' && (input.fileType === 'xls' || input.fileType === 'xlsx')
  return { allowed: true, source: excelPreview ? 'original' : input.variant }
}
