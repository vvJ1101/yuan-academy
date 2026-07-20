'use client'

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Maximize2,
  List,
  Minus,
  Plus,
  Printer,
  RotateCw,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  MoveHorizontal,
} from 'lucide-react'

import { PdfSearch } from './pdf-search'

interface PdfToolbarProps {
  page: number
  numPages: number
  scale: number
  query: string
  searchOpen: boolean
  searchResultCount: number
  searchResultIndex: number
  canDownload: boolean
  canPrint: boolean
  busyAction: 'download' | 'print' | null
  sidebarOpen: boolean
  fitMode: 'width' | 'page' | 'custom'
  onPageChange: (page: number) => void
  onPreviousPage: () => void
  onNextPage: () => void
  onZoomOut: () => void
  onZoomIn: () => void
  onRotate: () => void
  onToggleSidebar: () => void
  onFitWidth: () => void
  onFitPage: () => void
  onToggleSearch: () => void
  onSearchChange: (query: string) => void
  onPreviousSearchResult: () => void
  onNextSearchResult: () => void
  onToggleThumbnails: () => void
  onFullscreen: () => void
  onDownload: () => void
  onPrint: () => void
}

const toolButton = 'flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-30'

export function PdfToolbar(props: PdfToolbarProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-[52px] items-center gap-1 overflow-x-auto px-2 py-1.5">
        <button type="button" onClick={props.onToggleThumbnails} className={`${toolButton} md:hidden`} aria-label="打开页面缩略图">
          <List className="size-5" />
        </button>
        <button type="button" onClick={props.onPreviousPage} disabled={props.page <= 1} className={toolButton} aria-label="上一页">
          <ChevronLeft className="size-5" />
        </button>
        <label className="sr-only" htmlFor="pdf-page-input">当前页码</label>
        <input
          id="pdf-page-input"
          type="number"
          min={1}
          max={Math.max(1, props.numPages)}
          value={props.page}
          onChange={(event) => props.onPageChange(Number(event.target.value))}
          className="h-11 w-14 rounded-lg border border-neutral-200 px-2 text-center text-sm outline-none focus:border-blue-500"
        />
        <span className="whitespace-nowrap px-1 text-sm text-neutral-500">/ {props.numPages || '—'}</span>
        <button type="button" onClick={props.onNextPage} disabled={!props.numPages || props.page >= props.numPages} className={toolButton} aria-label="下一页">
          <ChevronRight className="size-5" />
        </button>

        <span className="mx-1 h-6 w-px shrink-0 bg-neutral-200" />
        <button type="button" onClick={props.onToggleSidebar} className={`${toolButton} hidden md:flex`} aria-label={props.sidebarOpen ? '收起页面缩略图' : '展开页面缩略图'}>
          {props.sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </button>
        <button type="button" onClick={props.onFitWidth} className={`${toolButton} hidden sm:flex ${props.fitMode === 'width' ? 'bg-blue-50 text-blue-700' : ''}`} aria-label="适应宽度">
          <MoveHorizontal className="size-4" />
        </button>
        <button type="button" onClick={props.onFitPage} className={`${toolButton} hidden sm:flex ${props.fitMode === 'page' ? 'bg-blue-50 text-blue-700' : ''}`} aria-label="适应页面">
          <Maximize2 className="size-4" />
        </button>
        <button type="button" onClick={props.onZoomOut} disabled={props.scale <= 0.5} className="hidden size-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 sm:flex" aria-label="缩小">
          <Minus className="size-4" />
        </button>
        <span className="hidden w-12 text-center text-xs text-neutral-500 sm:block">{Math.round(props.scale * 100)}%</span>
        <button type="button" onClick={props.onZoomIn} disabled={props.scale >= 3} className="hidden size-11 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 sm:flex" aria-label="放大">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={props.onRotate} className={`${toolButton} hidden sm:flex`} aria-label="顺时针旋转">
          <RotateCw className="size-4" />
        </button>
        <button type="button" onClick={props.onToggleSearch} className={`${toolButton} hidden sm:flex`} aria-label="搜索当前页">
          <Search className="size-4" />
        </button>

        <span className="ml-auto" />
        {props.canDownload && (
          <button type="button" onClick={props.onDownload} disabled={props.busyAction !== null} className={toolButton} aria-label="下载原文件">
            <Download className="size-4" />
          </button>
        )}
        {props.canPrint && (
          <button type="button" onClick={props.onPrint} disabled={props.busyAction !== null} className={`${toolButton} hidden sm:flex`} aria-label="打印">
            <Printer className="size-4" />
          </button>
        )}
        <button type="button" onClick={props.onFullscreen} className={toolButton} aria-label="全屏阅读">
          <Expand className="size-4" />
        </button>
      </div>
      {props.searchOpen && (
        <PdfSearch
          query={props.query}
          resultCount={props.searchResultCount}
          resultIndex={props.searchResultIndex}
          onChange={props.onSearchChange}
          onNext={props.onNextSearchResult}
          onPrevious={props.onPreviousSearchResult}
          onClose={props.onToggleSearch}
        />
      )}
    </div>
  )
}
