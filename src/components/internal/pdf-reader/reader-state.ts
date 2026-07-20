export const MIN_SCALE = 0.5
export const MAX_SCALE = 3
export const SCALE_STEP = 0.25

export type ReaderPermission = 'view' | 'edit' | 'delete' | 'admin'
export type ReaderFilePurpose = 'preview' | 'download' | 'print'
export type ReaderFitMode = 'width' | 'page' | 'custom'

export function getReaderActions(permission: ReaderPermission): {
  download: boolean
  print: boolean
} {
  const canExport = permission === 'edit' || permission === 'delete' || permission === 'admin'
  return { download: canExport, print: canExport }
}

export function buildReaderFileUrl(documentId: string, purpose: ReaderFilePurpose): string {
  const base = `/api/documents/${encodeURIComponent(documentId)}/file`
  if (purpose === 'download') return `${base}?variant=original&disposition=attachment`
  if (purpose === 'print') return `${base}?variant=preview&disposition=inline&purpose=print`
  return `${base}?variant=preview&disposition=inline`
}

export function buildDocumentReplacementUrl(documentId: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/replace`
}

export function calculateFitPageScale(input: {
  availableWidth: number
  availableHeight: number
  pageWidth: number
  pageHeight: number
  rotation: ReaderState['rotation']
}): number {
  const rotated = input.rotation === 90 || input.rotation === 270
  const width = rotated ? input.pageHeight : input.pageWidth
  const height = rotated ? input.pageWidth : input.pageHeight
  if (width <= 0 || height <= 0 || input.availableWidth <= 0 || input.availableHeight <= 0) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(input.availableWidth / width, input.availableHeight / height)))
}

export function calculateFitWidthScale(input: {
  availableWidth: number
  pageWidth: number
  pageHeight: number
  rotation: ReaderState['rotation']
}): number {
  const rotatedWidth = input.rotation === 90 || input.rotation === 270 ? input.pageHeight : input.pageWidth
  if (rotatedWidth <= 0 || input.availableWidth <= 0) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, input.availableWidth / rotatedWidth))
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] as string)
}

export function renderHighlightedText(text: string, query: string): string {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return escapeHtml(text)

  const normalizedText = text.toLocaleLowerCase()
  const parts: string[] = []
  let cursor = 0
  let match = normalizedText.indexOf(normalizedQuery)
  while (match !== -1) {
    parts.push(escapeHtml(text.slice(cursor, match)))
    parts.push(`<mark>${escapeHtml(text.slice(match, match + normalizedQuery.length))}</mark>`)
    cursor = match + normalizedQuery.length
    match = normalizedText.indexOf(normalizedQuery, cursor)
  }
  parts.push(escapeHtml(text.slice(cursor)))
  return parts.join('')
}

export type ReaderState = {
  page: number
  numPages: number
  scale: number
  rotation: 0 | 90 | 180 | 270
  searchResultCount: number
  searchResultIndex: number
  fitMode: ReaderFitMode
  sidebarOpen: boolean
}

export type ReaderAction =
  | { type: 'documentLoaded'; numPages: number }
  | { type: 'setPage'; page: number }
  | { type: 'nextPage' }
  | { type: 'previousPage' }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
  | { type: 'fitWidth'; scale?: number }
  | { type: 'fitPage'; scale: number }
  | { type: 'toggleSidebar' }
  | { type: 'rotateClockwise' }
  | { type: 'setSearchResultCount'; count: number }
  | { type: 'nextSearchResult' }
  | { type: 'previousSearchResult' }

export const initialReaderState: ReaderState = {
  page: 1,
  numPages: 0,
  scale: 1,
  rotation: 0,
  searchResultCount: 0,
  searchResultIndex: -1,
  fitMode: 'width',
  sidebarOpen: true,
}

export function clampPage(page: number, numPages: number): number {
  const lastPage = Math.max(1, Math.floor(numPages))
  return Math.min(lastPage, Math.max(1, Math.floor(page)))
}

export function nextScale(scale: number, direction: 'in' | 'out'): number {
  const change = direction === 'in' ? SCALE_STEP : -SCALE_STEP
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + change))
}

function cycleResult(index: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1
  return (index + direction + count) % count
}

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'documentLoaded': {
      const numPages = Math.max(0, Math.floor(action.numPages))
      return { ...state, numPages, page: clampPage(state.page, numPages) }
    }
    case 'setPage':
      return { ...state, page: clampPage(action.page, state.numPages) }
    case 'nextPage':
      return { ...state, page: clampPage(state.page + 1, state.numPages) }
    case 'previousPage':
      return { ...state, page: clampPage(state.page - 1, state.numPages) }
    case 'zoomIn':
      return { ...state, scale: nextScale(state.scale, 'in'), fitMode: 'custom' }
    case 'zoomOut':
      return { ...state, scale: nextScale(state.scale, 'out'), fitMode: 'custom' }
    case 'fitWidth':
      return { ...state, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, action.scale ?? 1)), fitMode: 'width' }
    case 'fitPage':
      return { ...state, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, action.scale)), fitMode: 'page' }
    case 'toggleSidebar':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'rotateClockwise':
      return { ...state, rotation: ((state.rotation + 90) % 360) as ReaderState['rotation'] }
    case 'setSearchResultCount': {
      const searchResultCount = Math.max(0, Math.floor(action.count))
      return {
        ...state,
        searchResultCount,
        searchResultIndex: searchResultCount > 0 ? 0 : -1,
      }
    }
    case 'nextSearchResult':
      return {
        ...state,
        searchResultIndex: cycleResult(state.searchResultIndex, state.searchResultCount, 1),
      }
    case 'previousSearchResult':
      return {
        ...state,
        searchResultIndex: cycleResult(state.searchResultIndex, state.searchResultCount, -1),
      }
  }
}
