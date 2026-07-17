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
const HIDDEN_PATH = '【路径已隐藏】'

export function sanitizeReplacementError(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback

  const withoutStack = value
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*(?:at\s|Caused by:|node:internal)/i.test(line))
    .join(' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')

  const redacted = withoutStack
    .replace(/(['"])(?:file:\/{2,3}|[A-Za-z]:[\\/]|\/(?:Users|var|home|tmp|private|opt|usr|etc|srv|data|Volumes|app|root|mnt|work|workspace)\/)[^'"\r\n]+\1/gi, (_match, quote: string) => `${quote}${HIDDEN_PATH}${quote}`)
    .replace(/\bfile:\/{2,3}[^\s'"<>，。；！？]+/gi, HIDDEN_PATH)
    .replace(/\b[A-Za-z]:[\\/][^\s'"<>，。；！？]+/g, HIDDEN_PATH)
    .replace(/\\\\[^\\\s]+\\[^\s'"<>，。；！？]+/g, HIDDEN_PATH)
    .replace(/\/(?:Users|var|home|tmp|private|opt|usr|etc|srv|data|Volumes|app|root|mnt|work|workspace)(?:\/[^\s'"<>，。；！？]*)?/gi, HIDDEN_PATH)
    .replace(/^\s*(?:Error|TypeError|RangeError|ReferenceError|SyntaxError):\s*/i, '')
    .replace(/\s+at\s+[A-Za-z0-9_$.[\]<>]+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const meaningful = redacted
    .replaceAll(HIDDEN_PATH, '')
    .replace(/\b(?:ENOENT|EACCES|EPERM|spawn|soffice|libreoffice|node:internal)\b/gi, '')
    .replace(/[^A-Za-z0-9\u3400-\u9fff]+/g, '')
  const hasChineseBusinessText = /[\u3400-\u9fff]/.test(meaningful)
  if (!redacted || !meaningful || !hasChineseBusinessText) return fallback

  const characters = Array.from(redacted)
  if (characters.length <= MAX_ERROR_LENGTH) return redacted
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
