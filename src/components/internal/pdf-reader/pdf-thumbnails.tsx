'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { Page } from './pdf-worker'

interface PdfThumbnailsProps {
  numPages: number
  currentPage: number
  onSelect: (page: number) => void
}

function LazyThumbnail({ page, current, onSelect }: { page: number; current: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(current || page <= 2)

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '180px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-[44px] w-full flex-col items-center gap-1 rounded-lg border-2 p-2 text-xs text-neutral-500 transition-colors',
        current ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-neutral-100',
      )}
      aria-current={current ? 'page' : undefined}
      aria-label={`跳转到第 ${page} 页`}
    >
      <div className="min-h-[142px] w-[102px] overflow-hidden bg-white shadow-sm">
        {visible ? (
          <Page
            pageNumber={page}
            width={102}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={<div className="h-[142px] animate-pulse bg-neutral-100" />}
          />
        ) : (
          <div className="h-[142px] bg-neutral-100" />
        )}
      </div>
      <span>{page}</span>
    </button>
  )
}

export function PdfThumbnails({ numPages, currentPage, onSelect }: PdfThumbnailsProps) {
  return (
    <nav className="space-y-2" aria-label="页面缩略图">
      {Array.from({ length: numPages }, (_, index) => index + 1).map((page) => (
        <LazyThumbnail
          key={page}
          page={page}
          current={page === currentPage}
          onSelect={() => onSelect(page)}
        />
      ))}
    </nav>
  )
}
