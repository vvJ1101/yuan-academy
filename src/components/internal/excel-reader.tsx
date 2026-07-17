'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, Loader2, Search } from 'lucide-react'

import type { Permission } from '@/lib/permissions/folders'
import {
  countSheetMatches,
  findDefaultSheetIndex,
  type WorkbookPreview,
  workbookToPreview,
} from '@/lib/excel-preview'

import { createExportResourceManager } from './pdf-reader/export-resources'
import { buildReaderFileUrl, getReaderActions } from './pdf-reader/reader-state'

interface ExcelReaderProps {
  documentId: string
  title: string
  permission: Permission
}

const FILE_ERROR = 'Excel 文件可能已损坏或格式不受支持，请联系文档管理员。'

export function ExcelReader({ documentId, title, permission }: ExcelReaderProps) {
  const [workbook, setWorkbook] = useState<WorkbookPreview | null>(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const mountedRef = useRef(true)
  const exportManagerRef = useRef<ReturnType<typeof createExportResourceManager> | null>(null)
  if (!exportManagerRef.current) exportManagerRef.current = createExportResourceManager()

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    setWorkbook(null)

    void fetch(buildReaderFileUrl(documentId, 'preview'), {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) throw new Error('你没有权限查看此文档')
        if (!response.ok) throw new Error('Excel 文件读取失败，请稍后重试')
        return response.arrayBuffer()
      })
      .then((buffer) => workbookToPreview(buffer))
      .then((preview) => {
        if (!mountedRef.current) return
        setWorkbook(preview)
        setActiveSheetIndex(findDefaultSheetIndex(preview))
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || (error instanceof DOMException && error.name === 'AbortError')) return
        setLoadError(error instanceof Error && error.message !== 'Excel 文件可能已损坏或格式不受支持'
          ? error.message
          : FILE_ERROR)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })

    return () => {
      mountedRef.current = false
      controller.abort()
      exportManagerRef.current?.cleanup()
    }
  }, [documentId])

  const activeSheet = workbook?.sheets[activeSheetIndex]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matchCount = useMemo(
    () => countSheetMatches(activeSheet, query),
    [activeSheet, query],
  )
  const canDownload = getReaderActions(permission).download

  const downloadOriginal = async () => {
    const manager = exportManagerRef.current!
    const signal = manager.begin()
    setDownloading(true)
    setActionError('')
    try {
      const response = await fetch(buildReaderFileUrl(documentId, 'download'), {
        credentials: 'same-origin',
        signal,
      })
      if (response.status === 403) throw new Error('你没有下载或打印权限')
      if (!response.ok) throw new Error('下载失败，请稍后重试')
      const blobUrl = URL.createObjectURL(await response.blob())
      manager.trackBlobUrl(blobUrl)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = title
      document.body.appendChild(link)
      link.click()
      link.remove()
      manager.deferCleanup(1000, { closePopup: false })
    } catch (error) {
      manager.cleanup()
      if (mountedRef.current && !(error instanceof DOMException && error.name === 'AbortError')) {
        setActionError(error instanceof Error ? error.message : '下载失败，请稍后重试')
      }
    } finally {
      if (mountedRef.current) setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-center">
        <Loader2 className="size-6 animate-spin text-blue-500" aria-hidden="true" />
        <p className="text-sm text-neutral-500">正在读取 Excel 文件…</p>
      </div>
    )
  }

  if (loadError || !workbook) {
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 text-center">
        <AlertCircle className="size-7 text-amber-600" aria-hidden="true" />
        <p role="alert" className="max-w-lg text-sm text-amber-800">
          {loadError || FILE_ERROR}
        </p>
        <p className="text-xs text-amber-700">请刷新页面重试；如果问题持续，请联系文档管理员。</p>
      </div>
    )
  }

  return (
    <section className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white" aria-label={`${title} Excel 阅读器`}>
      <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="工作表">
          {workbook.sheets.map((sheet, index) => (
            <button
              key={`${sheet.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={activeSheetIndex === index}
              onClick={() => {
                setActiveSheetIndex(index)
                setQuery('')
              }}
              className={`min-h-[44px] shrink-0 rounded-lg px-4 text-sm transition-colors ${
                activeSheetIndex === index
                  ? 'bg-blue-600 font-medium text-white'
                  : 'text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 md:w-64 md:flex-none">
            <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <span className="sr-only">搜索当前工作表</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索当前 Sheet"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <span className="min-w-16 text-right text-xs text-neutral-500" aria-live="polite">
            {normalizedQuery ? `${matchCount} 个匹配` : '输入关键词'}
          </span>
          {canDownload && (
            <button
              type="button"
              onClick={() => void downloadOriginal()}
              disabled={downloading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {downloading ? '下载中…' : '下载原文件'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {activeSheet?.truncated && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          当前显示前 1,000 行，共 {activeSheet.originalRowCount.toLocaleString('zh-CN')} 行。
        </p>
      )}

      {!activeSheet || activeSheet.rows.length === 0 ? (
        <div className="flex min-h-[45vh] items-center justify-center px-4 text-sm text-neutral-500">
          当前 Sheet 暂无内容
        </div>
      ) : (
        <div className="h-[70vh] max-w-full overflow-auto" role="region" aria-label={`${activeSheet.name} 表格`} tabIndex={0}>
          <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {activeSheet.rows[0]?.map((cell, columnIndex) => (
                  <th
                    key={columnIndex}
                    scope="col"
                    className={`sticky top-0 z-10 max-w-80 border-b border-r border-neutral-300 px-4 py-3 font-semibold text-neutral-800 ${
                      normalizedQuery && cell.toLocaleLowerCase().includes(normalizedQuery)
                        ? 'bg-yellow-200'
                        : 'bg-neutral-100'
                    }`}
                  >
                    <span className="block whitespace-pre-wrap break-words">{cell || `列 ${columnIndex + 1}`}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-white even:bg-neutral-50">
                  {row.map((cell, columnIndex) => {
                    const matched = normalizedQuery && cell.toLocaleLowerCase().includes(normalizedQuery)
                    return (
                      <td
                        key={columnIndex}
                        className={`max-w-80 border-b border-r border-neutral-200 px-4 py-2.5 align-top text-neutral-700 ${matched ? 'bg-yellow-100' : ''}`}
                      >
                        <span className="block whitespace-pre-wrap break-words">{cell}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
