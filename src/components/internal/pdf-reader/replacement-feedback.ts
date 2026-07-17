export type ReplacementOutcome =
  | {
      status: 'ready' | 'processing'
      accepted: true
      clearFile: true
      message: string
    }
  | {
      status: 'failed' | 'request-error'
      accepted: false
      clearFile: false
      message: string
    }

type ReplacementInput =
  | { kind: 'response'; ok: boolean; payload: unknown }
  | { kind: 'network'; error?: unknown }

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

const MAX_ERROR_LENGTH = 160

export function sanitizeReplacementError(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const raw = value.trim()
  const hasControlOrMultiline = /[\u0000-\u001f\u007f]/.test(raw)
  const hasFileUrl = /\bfile:(?:\/{2,3})?/i.test(raw)
  const hasWindowsDrivePath = /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]/.test(raw)
  const hasUncPath = /\\{2}[^\\\r\n]+\\[^\r\n]+/.test(raw)
  const hasPosixAbsolutePath = /(^|[^A-Za-z0-9._~/-])\/(?!\/)[^\s/\\:'"<>]+(?:[ \t][^\s/\\:'"<>]+)*(?:\/[^\r\n]*)?/.test(raw)
  const hasStackOrTechnicalDetail = /(?:^|\s)(?:Error|TypeError|RangeError|ReferenceError|SyntaxError):|\b(?:ENOENT|EACCES|EPERM|ECONNREFUSED|node:internal|spawn|soffice|libreoffice)\b|\bat\s+[A-Za-z0-9_$.[\]<>]+\s*\(/i.test(raw)

  if (
    hasControlOrMultiline
    || hasFileUrl
    || hasWindowsDrivePath
    || hasUncPath
    || hasPosixAbsolutePath
    || hasStackOrTechnicalDetail
  ) return fallback

  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned || !/[\u3400-\u9fff]/.test(cleaned)) return fallback

  const characters = Array.from(cleaned)
  if (characters.length <= MAX_ERROR_LENGTH) return cleaned
  return `${characters.slice(0, MAX_ERROR_LENGTH - 1).join('')}…`
}

export function mapReplacementOutcome(input: ReplacementInput): ReplacementOutcome {
  if (input.kind === 'network') {
    return {
      status: 'request-error',
      accepted: false,
      clearFile: false,
      message: '网络连接失败，请保留文件后重试。',
    }
  }

  const payload = record(input.payload)
  if (!input.ok) {
    return {
      status: 'request-error',
      accepted: false,
      clearFile: false,
      message: sanitizeReplacementError(payload.error, '替换文件失败，请保留文件后重试。'),
    }
  }

  const processing = record(payload.processing)
  if (processing.status === 'ready') {
    return {
      status: 'ready',
      accepted: true,
      clearFile: true,
      message: '替换完成，在线预览已恢复。',
    }
  }
  if (processing.status === 'processing') {
    return {
      status: 'processing',
      accepted: true,
      clearFile: true,
      message: '文件已接收，系统正在生成预览。',
    }
  }
  if (processing.status === 'failed') {
    const rawProcessingError = typeof processing.error === 'string' && processing.error.trim()
      ? processing.error
      : payload.processingError
    return {
      status: 'failed',
      accepted: false,
      clearFile: false,
      message: sanitizeReplacementError(rawProcessingError, '文件处理失败，请检查文件后直接重试。'),
    }
  }

  return {
    status: 'request-error',
    accepted: false,
    clearFile: false,
    message: '服务器未返回有效的处理状态，请保留文件后重试。',
  }
}
