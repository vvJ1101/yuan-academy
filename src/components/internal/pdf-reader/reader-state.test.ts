import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildReaderFileUrl,
  clampPage,
  getReaderActions,
  initialReaderState,
  nextScale,
  renderHighlightedText,
  readerReducer,
} from './reader-state'

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
