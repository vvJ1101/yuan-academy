export const MIN_SCALE = 0.5
export const MAX_SCALE = 3
export const SCALE_STEP = 0.25

export type ReaderState = {
  page: number
  numPages: number
  scale: number
  rotation: 0 | 90 | 180 | 270
  searchResultCount: number
  searchResultIndex: number
}

export type ReaderAction =
  | { type: 'documentLoaded'; numPages: number }
  | { type: 'setPage'; page: number }
  | { type: 'nextPage' }
  | { type: 'previousPage' }
  | { type: 'zoomIn' }
  | { type: 'zoomOut' }
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
      return { ...state, scale: nextScale(state.scale, 'in') }
    case 'zoomOut':
      return { ...state, scale: nextScale(state.scale, 'out') }
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
