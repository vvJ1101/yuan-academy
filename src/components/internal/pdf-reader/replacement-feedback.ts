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

function message(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
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
      message: message(payload.error) || '替换文件失败，请保留文件后重试。',
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
    return {
      status: 'failed',
      accepted: false,
      clearFile: false,
      message: message(processing.error) || message(payload.processingError) || '文件处理失败，请检查文件后直接重试。',
    }
  }

  return {
    status: 'request-error',
    accepted: false,
    clearFile: false,
    message: '服务器未返回有效的处理状态，请保留文件后重试。',
  }
}
