'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { AlertCircle, Loader2, X } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import type { Permission } from '@/lib/permissions/folders'

import { Document, Page } from './pdf-worker'
import { PdfThumbnails } from './pdf-thumbnails'
import { PdfToolbar } from './pdf-toolbar'
import {
  buildReaderFileUrl,
  getReaderActions,
  initialReaderState,
  readerReducer,
  renderHighlightedText,
} from './reader-state'

interface PdfReaderProps {
  documentId: string
  title: string
  permission: Permission
  fileType: string
}

function loadingPanel(progress: number | null) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-neutral-500">
      <Loader2 className="size-6 animate-spin text-blue-500" aria-hidden="true" />
      <p>正在加载文档{progress === null ? '…' : ` ${progress}%`}</p>
    </div>
  )
}

export function PdfReader({ documentId, title, permission, fileType }: PdfReaderProps) {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [fitWidth, setFitWidth] = useState(720)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState<'download' | 'print' | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileThumbnailsOpen, setMobileThumbnailsOpen] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const actions = getReaderActions(permission)
  const previewUrl = buildReaderFileUrl(documentId, 'preview')
  const file = useMemo(
    () => ({ url: retryKey ? `${previewUrl}&retry=${retryKey}` : previewUrl }),
    [previewUrl, retryKey],
  )
  const pdfOptions = useMemo(() => ({ withCredentials: true }), [])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const updateWidth = () => setFitWidth(Math.max(280, node.clientWidth - 32))
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [pdf])

  useEffect(() => {
    if (!pdf || state.numPages === 0) return
    const adjacent = [state.page - 1, state.page + 1].filter(
      (page) => page >= 1 && page <= state.numPages,
    )
    void Promise.all(adjacent.map((page) => pdf.getPage(page))).catch(() => undefined)
  }, [pdf, state.numPages, state.page])

  useEffect(() => {
    dispatch({ type: 'setSearchResultCount', count: 0 })
  }, [query, state.page])

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0, left: 0 })
  }, [state.page])

  useEffect(() => {
    const marks = rootRef.current?.querySelectorAll('mark')
    if (!marks?.length || state.searchResultIndex < 0) return
    marks.forEach((mark) => mark.classList.remove('ring-2', 'ring-orange-500'))
    const active = marks.item(state.searchResultIndex)
    active?.classList.add('ring-2', 'ring-orange-500')
    active?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [query, state.page, state.searchResultCount, state.searchResultIndex])

  const handleDocumentLoaded = useCallback((loadedPdf: PDFDocumentProxy) => {
    setPdf(loadedPdf)
    setLoadError('')
    setLoadProgress(100)
    dispatch({ type: 'documentLoaded', numPages: loadedPdf.numPages })
  }, [])

  const handleExport = useCallback(async (purpose: 'download' | 'print') => {
    const printWindow = purpose === 'print' ? window.open('', '_blank') : null
    if (printWindow) printWindow.opener = null
    setBusyAction(purpose)
    setActionError('')
    try {
      const response = await fetch(buildReaderFileUrl(documentId, purpose), {
        credentials: 'same-origin',
      })
      if (response.status === 403) throw new Error('你没有下载或打印权限')
      if (!response.ok) throw new Error(purpose === 'print' ? '打印文件读取失败，请稍后重试' : '下载失败，请稍后重试')
      const blobUrl = URL.createObjectURL(await response.blob())
      if (purpose === 'download') {
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = `${title}.${fileType}`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      } else if (printWindow) {
        printWindow.location.href = blobUrl
        printWindow.addEventListener('load', () => {
          printWindow.focus()
          printWindow.print()
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
        }, { once: true })
      } else {
        URL.revokeObjectURL(blobUrl)
        throw new Error('浏览器阻止了打印窗口，请允许弹出窗口后重试')
      }
    } catch (error) {
      printWindow?.close()
      setActionError(error instanceof Error ? error.message : '操作失败，请稍后重试')
    } finally {
      setBusyAction(null)
    }
  }, [documentId, fileType, title])

  const handleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await rootRef.current?.requestFullscreen()
    } catch {
      setActionError('当前浏览器无法进入全屏模式')
    }
  }, [])

  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => renderHighlightedText(str, query),
    [query],
  )

  const documentErrorPanel = (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertCircle className="size-8 text-amber-500" aria-hidden="true" />
      <p className="max-w-md text-sm text-neutral-600">
        {loadError || '文档加载失败，请重试；如果问题持续，请联系文档管理员。'}
      </p>
      <button
        type="button"
        onClick={() => {
          setPdf(null)
          setLoadError('')
          setLoadProgress(null)
          setRetryKey((value) => value + 1)
        }}
        className="min-h-[44px] rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700"
      >
        重新加载
      </button>
    </div>
  )

  return (
    <div ref={rootRef} className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 fullscreen:rounded-none fullscreen:border-0">
      <Document
        file={file}
        options={pdfOptions}
        onLoadSuccess={handleDocumentLoaded}
        onLoadProgress={({ loaded, total }) => setLoadProgress(total ? Math.round((loaded / total) * 100) : null)}
        onLoadError={() => setLoadError('文档加载失败，请重试；如果问题持续，请联系文档管理员。')}
        loading={loadingPanel(loadProgress)}
        error={documentErrorPanel}
        noData={<p className="p-8 text-center text-sm text-neutral-500">没有可读取的 PDF 文件</p>}
      >
        {pdf ? (
          <>
            <PdfToolbar
              page={state.page}
              numPages={state.numPages}
              scale={state.scale}
              query={query}
              searchOpen={searchOpen}
              searchResultCount={state.searchResultCount}
              searchResultIndex={state.searchResultIndex}
              canDownload={actions.download}
              canPrint={actions.print}
              busyAction={busyAction}
              onPageChange={(page) => dispatch({ type: 'setPage', page })}
              onPreviousPage={() => dispatch({ type: 'previousPage' })}
              onNextPage={() => dispatch({ type: 'nextPage' })}
              onZoomOut={() => dispatch({ type: 'zoomOut' })}
              onZoomIn={() => dispatch({ type: 'zoomIn' })}
              onRotate={() => dispatch({ type: 'rotateClockwise' })}
              onToggleSearch={() => setSearchOpen((open) => !open)}
              onSearchChange={setQuery}
              onPreviousSearchResult={() => dispatch({ type: 'previousSearchResult' })}
              onNextSearchResult={() => dispatch({ type: 'nextSearchResult' })}
              onToggleThumbnails={() => setMobileThumbnailsOpen(true)}
              onFullscreen={handleFullscreen}
              onDownload={() => void handleExport('download')}
              onPrint={() => void handleExport('print')}
            />

            {actionError && (
              <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div className="flex min-h-[70vh]">
              <aside className="hidden w-36 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-2 md:block" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
                <PdfThumbnails numPages={state.numPages} currentPage={state.page} onSelect={(page) => dispatch({ type: 'setPage', page })} />
              </aside>
              <div ref={viewportRef} className="flex min-w-0 flex-1 justify-center overflow-auto p-4" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
                <Page
                  key={`${state.page}-${state.rotation}`}
                  pageNumber={state.page}
                  width={fitWidth}
                  scale={state.scale}
                  rotate={state.rotation}
                  customTextRenderer={query ? customTextRenderer : undefined}
                  onGetTextSuccess={({ items }) => {
                    const normalizedQuery = query.trim().toLocaleLowerCase()
                    let count = 0
                    if (normalizedQuery) {
                      for (const item of items) {
                        if (!('str' in item)) continue
                        const text = item.str.toLocaleLowerCase()
                        let cursor = text.indexOf(normalizedQuery)
                        while (cursor !== -1) {
                          count += 1
                          cursor = text.indexOf(normalizedQuery, cursor + normalizedQuery.length)
                        }
                      }
                    }
                    dispatch({ type: 'setSearchResultCount', count })
                  }}
                  loading={<div className="flex min-h-[60vh] min-w-[280px] items-center justify-center"><Loader2 className="size-6 animate-spin text-blue-500" /></div>}
                  error={<p className="p-8 text-sm text-red-600">当前页渲染失败，请切换页面或重新加载。</p>}
                  className="bg-white shadow-lg"
                />
              </div>
            </div>

            {mobileThumbnailsOpen && (
              <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="页面缩略图">
                <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setMobileThumbnailsOpen(false)} aria-label="关闭页面缩略图" />
                <aside className="absolute inset-y-0 left-0 w-[min(80vw,20rem)] overflow-y-auto bg-white p-3 shadow-xl">
                  <div className="sticky top-0 z-10 mb-2 flex min-h-[44px] items-center justify-between bg-white">
                    <h2 className="text-sm font-medium text-neutral-800">页面缩略图</h2>
                    <button type="button" onClick={() => setMobileThumbnailsOpen(false)} className="flex size-11 items-center justify-center rounded-lg hover:bg-neutral-100" aria-label="关闭">
                      <X className="size-5" />
                    </button>
                  </div>
                  <PdfThumbnails
                    numPages={state.numPages}
                    currentPage={state.page}
                    onSelect={(page) => {
                      dispatch({ type: 'setPage', page })
                      setMobileThumbnailsOpen(false)
                    }}
                  />
                </aside>
              </div>
            )}
          </>
        ) : null}
      </Document>
    </div>
  )
}
