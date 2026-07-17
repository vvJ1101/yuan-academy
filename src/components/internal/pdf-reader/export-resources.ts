export interface ExportPopup {
  addEventListener(type: 'load' | 'error', listener: () => void): void
  removeEventListener(type: 'load' | 'error', listener: () => void): void
  close(): void
}

type Timer = ReturnType<typeof setTimeout> | unknown

interface ExportResourceDependencies {
  revokeObjectURL?: (url: string) => void
  setTimer?: (callback: () => void, delay: number) => Timer
  clearTimer?: (timer: Timer) => void
}

export function createExportResourceManager(dependencies: ExportResourceDependencies = {}) {
  const revokeObjectURL = dependencies.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  const setTimer = dependencies.setTimer ?? ((callback: () => void, delay: number) => setTimeout(callback, delay))
  const clearTimer = dependencies.clearTimer ?? ((timer: Timer) => clearTimeout(timer as ReturnType<typeof setTimeout>))

  let controller: AbortController | null = null
  let blobUrl: string | null = null
  let popup: ExportPopup | null = null
  let loadListener: (() => void) | null = null
  let errorListener: (() => void) | null = null
  let timer: Timer | null = null

  const clearWatch = () => {
    if (popup && loadListener) popup.removeEventListener('load', loadListener)
    if (popup && errorListener) popup.removeEventListener('error', errorListener)
    loadListener = null
    errorListener = null
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  const cleanup = (options: { closePopup?: boolean } = {}) => {
    controller?.abort()
    controller = null
    clearWatch()
    if (blobUrl) revokeObjectURL(blobUrl)
    blobUrl = null
    if (popup && options.closePopup !== false) popup.close()
    popup = null
  }

  return {
    begin(): AbortSignal {
      cleanup()
      controller = new AbortController()
      return controller.signal
    },
    trackPopup(nextPopup: ExportPopup | null) {
      popup = nextPopup
    },
    trackBlobUrl(nextBlobUrl: string) {
      if (blobUrl) revokeObjectURL(blobUrl)
      blobUrl = nextBlobUrl
    },
    watchPopup(onLoad: () => void, onError: () => void, timeoutMs: number, onTimeout: () => void) {
      clearWatch()
      if (!popup) return
      loadListener = () => {
        clearWatch()
        onLoad()
      }
      errorListener = () => {
        clearWatch()
        onError()
      }
      popup.addEventListener('load', loadListener)
      popup.addEventListener('error', errorListener)
      timer = setTimer(() => {
        clearWatch()
        onTimeout()
      }, timeoutMs)
    },
    deferCleanup(delay: number, options: { closePopup?: boolean } = {}) {
      clearWatch()
      timer = setTimer(() => cleanup(options), delay)
    },
    cleanup,
  }
}
