import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDocumentReplacementUrl,
  buildReaderFileUrl,
  calculateFitPageScale,
  calculateFitWidthScale,
  clampPage,
  getReaderActions,
  initialReaderState,
  nextScale,
  renderHighlightedText,
  readerReducer,
} from './reader-state'
import { createExportResourceManager } from './export-resources'

test('clampPage keeps page numbers inside the loaded document', () => {
  assert.equal(clampPage(-1, 12), 1)
  assert.equal(clampPage(5, 12), 5)
  assert.equal(clampPage(20, 12), 12)
  assert.equal(clampPage(1, 0), 1)
})

test('next and previous navigation stop at document boundaries', () => {
  const loaded = readerReducer(initialReaderState, { type: 'documentLoaded', numPages: 3 })

  assert.equal(readerReducer(loaded, { type: 'previousPage' }).page, 1)
  assert.equal(readerReducer(loaded, { type: 'nextPage' }).page, 2)
  assert.equal(
    readerReducer({ ...loaded, page: 3 }, { type: 'nextPage' }).page,
    3,
  )
})

test('page input is clamped when the document is loaded', () => {
  const loaded = { ...initialReaderState, numPages: 8 }

  assert.equal(readerReducer(loaded, { type: 'setPage', page: 99 }).page, 8)
  assert.equal(readerReducer(loaded, { type: 'setPage', page: 0 }).page, 1)
})

test('zoom advances in 25 percent steps between 50 and 300 percent', () => {
  assert.equal(nextScale(1, 'in'), 1.25)
  assert.equal(nextScale(0.5, 'out'), 0.5)
  assert.equal(nextScale(3, 'in'), 3)
  assert.equal(readerReducer(initialReaderState, { type: 'zoomOut' }).scale, 0.75)
})

test('rotation advances in normalized 90-degree increments', () => {
  let state = initialReaderState

  for (const expected of [90, 180, 270, 0]) {
    state = readerReducer(state, { type: 'rotateClockwise' })
    assert.equal(state.rotation, expected)
  }
})

test('search result navigation cycles in both directions', () => {
  const withResults = readerReducer(initialReaderState, {
    type: 'setSearchResultCount',
    count: 3,
  })

  assert.equal(withResults.searchResultIndex, 0)
  assert.equal(readerReducer(withResults, { type: 'previousSearchResult' }).searchResultIndex, 2)
  assert.equal(
    readerReducer({ ...withResults, searchResultIndex: 2 }, { type: 'nextSearchResult' })
      .searchResultIndex,
    0,
  )
})

test('empty search results keep a sentinel index', () => {
  const state = readerReducer(
    { ...initialReaderState, searchResultCount: 2, searchResultIndex: 1 },
    { type: 'setSearchResultCount', count: 0 },
  )

  assert.equal(state.searchResultCount, 0)
  assert.equal(state.searchResultIndex, -1)
  assert.equal(readerReducer(state, { type: 'nextSearchResult' }).searchResultIndex, -1)
})

test('document load records total pages and clamps the current page', () => {
  const state = readerReducer(
    { ...initialReaderState, page: 9 },
    { type: 'documentLoaded', numPages: 4 },
  )

  assert.equal(state.numPages, 4)
  assert.equal(state.page, 4)
})

test('search count transition selects the first result', () => {
  const state = readerReducer(initialReaderState, {
    type: 'setSearchResultCount',
    count: 2,
  })

  assert.equal(state.searchResultCount, 2)
  assert.equal(state.searchResultIndex, 0)
})

test('reader actions hide download and print from view permission', () => {
  assert.deepEqual(getReaderActions('view'), { download: false, print: false })
  assert.deepEqual(getReaderActions('edit'), { download: true, print: true })
  assert.deepEqual(getReaderActions('delete'), { download: true, print: true })
  assert.deepEqual(getReaderActions('admin'), { download: true, print: true })
})

test('protected reader URLs use the same-origin document file endpoint', () => {
  assert.equal(
    buildReaderFileUrl('doc_123', 'preview'),
    '/api/documents/doc_123/file?variant=preview&disposition=inline',
  )
  assert.equal(
    buildReaderFileUrl('doc_123', 'download'),
    '/api/documents/doc_123/file?variant=original&disposition=attachment',
  )
  assert.equal(
    buildReaderFileUrl('doc_123', 'print'),
    '/api/documents/doc_123/file?variant=preview&disposition=inline&purpose=print',
  )
})

test('search highlighting escapes PDF text and the query before adding marks', () => {
  assert.equal(
    renderHighlightedText('<script>安全</script> 安全', '安全'),
    '&lt;script&gt;<mark>安全</mark>&lt;/script&gt; <mark>安全</mark>',
  )
  assert.equal(renderHighlightedText('预算 (Q1)', '(Q1)'), '预算 <mark>(Q1)</mark>')
})

test('failed preview recovery keeps the current document id in the replacement route', () => {
  assert.equal(buildDocumentReplacementUrl('doc failed/1'), '/api/documents/doc%20failed%2F1/replace')
})

test('desktop sidebar toggles without changing the current page', () => {
  const hidden = readerReducer(initialReaderState, { type: 'toggleSidebar' })
  assert.equal(hidden.sidebarOpen, false)
  assert.equal(hidden.page, 1)
  assert.equal(readerReducer(hidden, { type: 'toggleSidebar' }).sidebarOpen, true)
})

test('fit modes remain explicit and manual zoom returns to custom mode', () => {
  const pageFit = readerReducer(initialReaderState, { type: 'fitPage', scale: 0.72 })
  assert.equal(pageFit.fitMode, 'page')
  assert.equal(pageFit.scale, 0.72)

  const widthFit = readerReducer(pageFit, { type: 'fitWidth' })
  assert.equal(widthFit.fitMode, 'width')
  assert.equal(widthFit.scale, 1)

  const zoomed = readerReducer(widthFit, { type: 'zoomIn' })
  assert.equal(zoomed.fitMode, 'custom')
  assert.equal(zoomed.scale, 1.25)
})

test('fit-page scale responds to dimensions, rotation, and zoom boundaries', () => {
  assert.equal(calculateFitPageScale({ availableWidth: 800, availableHeight: 600, pageWidth: 800, pageHeight: 1200, rotation: 0 }), 0.5)
  assert.equal(calculateFitPageScale({ availableWidth: 800, availableHeight: 600, pageWidth: 800, pageHeight: 1200, rotation: 90 }), 2 / 3)
  assert.equal(calculateFitPageScale({ availableWidth: 4000, availableHeight: 4000, pageWidth: 200, pageHeight: 200, rotation: 0 }), 3)
})

test('fit-width scale recomputes when the reader is resized', () => {
  const page = { pageWidth: 600, pageHeight: 900, rotation: 0 as const }
  assert.equal(calculateFitWidthScale({ ...page, availableWidth: 900 }), 1.5)
  assert.equal(calculateFitWidthScale({ ...page, availableWidth: 450 }), 0.75)
  assert.equal(calculateFitWidthScale({ ...page, availableWidth: 100 }), 0.5)
})

test('export manager aborts, revokes, removes listeners, clears timers, and closes popup', () => {
  const revoked: string[] = []
  const cleared: unknown[] = []
  const listeners = new Map<string, () => void>()
  let timerCallback: (() => void) | null = null
  let closed = 0
  const popup = {
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
    close: () => { closed += 1 },
  }
  const manager = createExportResourceManager({
    revokeObjectURL: (url) => revoked.push(url),
    setTimer: (callback) => { timerCallback = callback; return 'timer' },
    clearTimer: (timer) => cleared.push(timer),
  })

  const firstSignal = manager.begin()
  manager.trackPopup(popup)
  manager.trackBlobUrl('blob:first')
  manager.watchPopup(() => undefined, () => undefined, 5000, () => undefined)
  assert.equal(listeners.size, 2)
  assert.ok(timerCallback)

  manager.cleanup()
  assert.equal(firstSignal.aborted, true)
  assert.deepEqual(revoked, ['blob:first'])
  assert.deepEqual(cleared, ['timer'])
  assert.equal(listeners.size, 0)
  assert.equal(closed, 1)
})

test('starting a new export cleans the previous active export first', () => {
  const revoked: string[] = []
  const manager = createExportResourceManager({ revokeObjectURL: (url) => revoked.push(url) })
  const firstSignal = manager.begin()
  manager.trackBlobUrl('blob:old')
  const secondSignal = manager.begin()

  assert.equal(firstSignal.aborted, true)
  assert.equal(secondSignal.aborted, false)
  assert.deepEqual(revoked, ['blob:old'])
})

test('print fallback timeout releases the popup and Blob even when load never fires', () => {
  let timerCallback: (() => void) | null = null
  let closed = false
  const revoked: string[] = []
  const listeners = new Map<string, () => void>()
  const popup = {
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
    close: () => { closed = true },
  }
  const manager = createExportResourceManager({
    revokeObjectURL: (url) => revoked.push(url),
    setTimer: (callback) => { timerCallback = callback; return 1 },
    clearTimer: () => undefined,
  })
  manager.begin()
  manager.trackPopup(popup)
  manager.trackBlobUrl('blob:print')
  manager.watchPopup(
    () => undefined,
    () => manager.cleanup(),
    15_000,
    () => manager.cleanup(),
  )

  assert.ok(timerCallback)
  ;(timerCallback as () => void)()
  assert.equal(closed, true)
  assert.deepEqual(revoked, ['blob:print'])
  assert.equal(listeners.size, 0)
})
