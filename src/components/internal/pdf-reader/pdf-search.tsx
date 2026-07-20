'use client'

import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

interface PdfSearchProps {
  query: string
  resultCount: number
  resultIndex: number
  onChange: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

export function PdfSearch({
  query,
  resultCount,
  resultIndex,
  onChange,
  onNext,
  onPrevious,
  onClose,
}: PdfSearchProps) {
  return (
    <div className="flex w-full items-center gap-1 border-t border-neutral-200 bg-white px-2 py-2 md:w-auto md:border-l md:border-t-0 md:py-0">
      <Search aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
      <label className="sr-only" htmlFor="pdf-search-input">搜索当前页</label>
      <input
        id="pdf-search-input"
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索当前页"
        className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none md:w-36"
        autoFocus
      />
      <span className="whitespace-nowrap text-xs text-neutral-400">
        {resultCount > 0 ? `${resultIndex + 1}/${resultCount}` : '0/0'}
      </span>
      <button
        type="button"
        onClick={onPrevious}
        disabled={resultCount === 0}
        className="flex size-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
        aria-label="上一个搜索结果"
      >
        <ChevronUp className="size-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={resultCount === 0}
        className="flex size-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
        aria-label="下一个搜索结果"
      >
        <ChevronDown className="size-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="flex size-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
        aria-label="关闭搜索"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
