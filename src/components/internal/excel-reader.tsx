'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, Loader2, Printer, Search, Upload } from 'lucide-react'

import type { Permission } from '@/lib/permissions/folders'
import {
  countSheetMatches,
  EXCEL_PREVIEW_LIMITS,
  findDefaultSheetIndex,
  type WorkbookPreview,
  workbookToPreview,
} from '@/lib/excel-preview'

import { createExportResourceManager } from './pdf-reader/export-resources'
import { buildReaderFileUrl, getReaderActions } from './pdf-reader/reader-state'
import type { ReplacementOutcome } from './pdf-reader/replacement-feedback'
import { createRequestGuard, getSafeWorkbookDownloadName } from './excel-reader-state'

interface ExcelReaderProps {
  documentId: string
  title: string
  permission: Permission
  fileType: 'xls' | 'xlsx'
  onReplaceFile?: (file: File) => Promise<ReplacementOutcome>
}

const FILE_ERROR = 'Excel 文件可能已损坏或格式不受支持，请联系文档管理员。'

export function ExcelReader({ documentId, title, permission, fileType, onReplaceFile }: ExcelReaderProps) {
  const [workbook, setWorkbook] = useState<WorkbookPreview | null>(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState<'download' | 'print' | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [replacementFile, setReplacementFile] = useState<File | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const mountedRef = useRef(true)
  const replacementInputRef = useRef<HTMLInputElement>(null)
  const exportManagerRef = useRef<ReturnType<typeof createExportResourceManager> | null>(null)
  if (!exportManagerRef.current) exportManagerRef.current = createExportResourceManager()

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      exportManagerRef.current?.cleanup()
    }
  }, [])

  useEffect(() => {
    const requestGuard = createRequestGuard()
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
        if (!requestGuard.isActive()) return
        setWorkbook(preview)
        setActiveSheetIndex(findDefaultSheetIndex(preview))
      })
      .catch((error: unknown) => {
        if (!requestGuard.isActive() || (error instanceof DOMException && error.name === 'AbortError')) return
        setLoadError(error instanceof Error && error.message !== 'Excel 文件可能已损坏或格式不受支持'
          ? error.message
          : FILE_ERROR)
      })
      .finally(() => {
        if (requestGuard.isActive()) setLoading(false)
      })

    return () => {
      requestGuard.cancel()
      controller.abort()
    }
  }, [documentId])

  const activeSheet = workbook?.sheets[activeSheetIndex]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matchCount = useMemo(
    () => countSheetMatches(activeSheet, query),
    [activeSheet, query],
  )
  const actions = getReaderActions(permission)
  const canDownload = actions.download
  const canPrint = actions.print

  const escapePrintCell = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] as string)

  const downloadOriginal = async () => {
    const manager = exportManagerRef.current!
    const signal = manager.begin()
    setBusyAction('download')
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
      link.download = getSafeWorkbookDownloadName(title, fileType)
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
      if (mountedRef.current) setBusyAction(null)
    }
  }

  const printCurrentSheet = async () => {
    if (!activeSheet) return
    const manager = exportManagerRef.current!
    const signal = manager.begin()
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.opener = null
      manager.trackPopup(printWindow)
    }
    setBusyAction('print')
    setActionError('')
    try {
      if (!printWindow) throw new Error('浏览器阻止了打印窗口，请允许弹出窗口后重试')
      const response = await fetch(buildReaderFileUrl(documentId, 'print'), {
        credentials: 'same-origin',
        headers: { Range: 'bytes=0-0' },
        signal,
      })
      if (response.status === 403) throw new Error('你没有下载或打印权限')
      if (!response.ok && response.status !== 206) throw new Error('打印文件读取失败，请稍后重试')
      const headerCells = activeSheet.rows[0] ?? []
      const bodyRows = activeSheet.rows.slice(1)
      const tableHead = headerCells.map((cell, index) => (
        `<th>${escapePrintCell(cell || `列 ${index + 1}`)}</th>`
      )).join('')
      const tableBody = bodyRows.map((row) => (
        `<tr>${row.map((cell) => `<td>${escapePrintCell(cell)}</td>`).join('')}</tr>`
      )).join('')
      printWindow.document.open()
      printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapePrintCell(title)} - ${escapePrintCell(activeSheet.name)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #171717; }
h1 { font-size: 18px; margin: 0 0 6px; }
p { margin: 0 0 16px; color: #525252; font-size: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 11px; }
th, td { border: 1px solid #d4d4d4; padding: 6px; text-align: left; vertical-align: top; word-break: break-word; }
th { background: #f5f5f5; }
</style>
</head>
<body>
<h1>${escapePrintCell(title)}</h1>
<p>Sheet：${escapePrintCell(activeSheet.name)}；当前打印网页预览内容。</p>
<table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
</body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      manager.deferCleanup(60_000, { closePopup: false })
    } catch (error) {
      manager.cleanup()
      if (mountedRef.current && !(error instanceof DOMException && error.name === 'AbortError')) {
        setActionError(error instanceof Error ? error.message : '打印文件读取失败，请稍后重试')
      }
    } finally {
      if (mountedRef.current) setBusyAction(null)
    }
  }

  const replaceWorkbook = async (file: File) => {
    if (!onReplaceFile) return
    setReplacing(true)
    setActionError('')
    setRecoveryMessage('')
    try {
      const outcome = await onReplaceFile(file)
      if (!mountedRef.current) return
      if (outcome.accepted) {
        setReplacementFile(null)
        if (replacementInputRef.current) replacementInputRef.current.value = ''
        setRecoveryMessage(outcome.message)
      } else {
        setActionError(outcome.message)
      }
    } catch {
      if (mountedRef.current) setActionError('网络连接失败，请保留文件后重试。')
    } finally {
      if (mountedRef.current) setReplacing(false)
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
    const canRecover = getReaderActions(permission).download
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 text-center">
        <AlertCircle className="size-7 text-amber-600" aria-hidden="true" />
        <p role="alert" className="max-w-lg text-sm text-amber-800">
          {loadError || FILE_ERROR}
        </p>
        <p className="text-xs text-amber-700">请刷新页面重试；如果问题持续，请联系文档管理员。</p>
        {canRecover && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {onReplaceFile && (
              <>
                <input
                  ref={replacementInputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setReplacementFile(file)
                    void replaceWorkbook(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => replacementFile
                    ? void replaceWorkbook(replacementFile)
                    : replacementInputRef.current?.click()}
                  disabled={replacing}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {replacing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {replacing ? '正在替换…' : replacementFile ? `重试：${replacementFile.name}` : '替换文件并重试'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void downloadOriginal()}
              disabled={busyAction !== null}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-800 px-4 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {busyAction === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busyAction === 'download' ? '下载中…' : '下载原文件'}
            </button>
          </div>
        )}
        {recoveryMessage && <p role="status" className="text-xs text-emerald-700">{recoveryMessage}</p>}
        {actionError && <p role="alert" className="text-xs text-red-700">{actionError}</p>}
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
              disabled={busyAction !== null}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              {busyAction === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {busyAction === 'download' ? '下载中…' : '下载原文件'}
            </button>
          )}
          {canPrint && (
            <button
              type="button"
              onClick={() => void printCurrentSheet()}
              disabled={busyAction !== null}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              {busyAction === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              {busyAction === 'print' ? '准备打印…' : '打印当前 Sheet'}
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
          当前显示前 {EXCEL_PREVIEW_LIMITS.maxRows.toLocaleString('zh-CN')} 行，共 {activeSheet.originalRowCount.toLocaleString('zh-CN')} 行。
        </p>
      )}
      {activeSheet?.columnsTruncated && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          当前 Sheet 共有 {activeSheet.originalColumnCount.toLocaleString('zh-CN')} 列，为保障性能仅显示前 {EXCEL_PREVIEW_LIMITS.maxColumns} 列。
        </p>
      )}
      {workbook.sheetsTruncated && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          工作簿共有 {workbook.originalSheetCount.toLocaleString('zh-CN')} 个 Sheet，为保障性能仅显示前 {EXCEL_PREVIEW_LIMITS.maxSheets} 个。
        </p>
      )}
      {workbook.totalCellsTruncated && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          当前工作簿预览已达到 {EXCEL_PREVIEW_LIMITS.maxTotalCells.toLocaleString('zh-CN')} 个单元格上限，后续内容未显示；
          {canDownload ? '可下载原文件完整查看。' : '如需完整内容，请联系文档管理员。'}
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
