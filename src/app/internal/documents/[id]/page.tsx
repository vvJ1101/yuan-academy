'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, Eye, Edit3, Save, Star, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Permission } from '@/lib/permissions/folders'

const PdfReader = dynamic(
  () => import('@/components/internal/pdf-reader/pdf-reader').then((module) => module.PdfReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
        <Loader2 className="size-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-neutral-500">正在打开在线阅读器…</span>
      </div>
    ),
  },
)

interface Doc {
  id: string; title: string; slug: string; content: string; fullContent: string; condensedContent: string
  displayMode: string; category: string; ownerDeptId: string
  ownerDept: { name: string; slug: string } | null
  audiences: { id: string; departmentId: string; department: { name: string; slug: string } }[]
  author: { name: string }; updatedAt: string
  userPermission: string | null
  fileType: string
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed'
  processingError: string | null
}

type Tab = 'preview' | 'edit'

const catLabels: Record<string, string> = { training: '培训资料', sop: 'SOP', reference: '企业制度', brand: '品牌资产', policy: '订货政策', general: '通用' }

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('preview')
  const [editContent, setEditContent] = useState('')
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloadingOriginal, setDownloadingOriginal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [bookmarked, setBookmarked] = useState(false)
  const [history, setHistory] = useState<{id:string;userId:string;action:string;createdAt:string;user?:{name:string}}[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  useEffect(() => {
    if (!id) return
    // Load history
    fetch(`/api/documents/${id}/history`)
      .then(r => r.json())
      .then(d => { if (d?.history) setHistory(d.history); setHistoryLoaded(true) })
      .catch(() => setHistoryLoaded(true))
  }, [id, doc?.updatedAt])

  useEffect(() => {
    if (!id) return
    fetch(`/api/documents/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.id) {
          setDoc(data)
          setEditContent(data.fullContent || data.content || '')
          if (data.userPermission === 'admin' || data.userPermission === 'edit') setTab('preview')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/bookmarks')
      .then(r => r.json())
      .then(d => { if (d?.ids?.includes(id)) setBookmarked(true) })
      .catch((err: any) => console.warn("[SilentError]", err))
  }, [id])

  const canEdit = doc?.userPermission === 'admin' || doc?.userPermission === 'edit' || doc?.userPermission === 'delete'

  const handleSave = async () => {
    if (!doc) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, remark: remark || undefined }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDoc(prev => prev ? { ...prev, fullContent: editContent, content: editContent, updatedAt: updated.updatedAt } : prev)
        setSaved(true)
        setTab('preview')
        setTimeout(() => setSaved(false), 3000)
      } else {
        const e = await res.json().catch(() => ({}))
        setError(e.error || '保存失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSaving(false)
    }
  }

  const toggleBookmark = async () => {
    if (!doc?.id) return
    if (bookmarked) {
      await fetch(`/api/bookmarks?documentId=${encodeURIComponent(doc.id)}`, { method: 'DELETE' })
      setBookmarked(false)
    } else {
      await fetch('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: doc.id }) })
      setBookmarked(true)
    }
  }

  const handleFailedPreviewDownload = async () => {
    if (!doc || !canEdit) return
    setDownloadingOriginal(true)
    setError('')
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/file?variant=original&disposition=attachment`, {
        credentials: 'same-origin',
      })
      if (response.status === 403) throw new Error('你没有下载或打印权限')
      if (!response.ok) throw new Error('下载失败，请稍后重试')
      const blobUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${doc.title}.${doc.fileType}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '下载失败，请稍后重试')
    } finally {
      setDownloadingOriginal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={18} strokeWidth={1} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="p-10 text-center">
        <p className="text-neutral-500 mb-4">文档未找到</p>
        <Link href="/internal/documents" className="text-[0.82rem] text-neutral-500 hover:text-neutral-900">&larr; 返回文档列表</Link>
      </div>
    )
  }

  const displayContent = tab === 'preview' ? (doc.fullContent || doc.content) : editContent
  const usesPdfReader = ['pdf', 'ppt', 'pptx'].includes(doc.fileType)
  const readerPermission: Permission = ['view', 'edit', 'delete', 'admin'].includes(doc.userPermission || '')
    ? doc.userPermission as Permission
    : 'view'

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 pb-16 pt-6 md:pt-8">

      {/* ── Top bar: back + actions ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Link href="/internal/documents"
          className="inline-flex items-center gap-1.5 text-[0.82rem] text-neutral-400 hover:text-neutral-700 transition-colors min-h-[44px] px-2">
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span className="hidden sm:inline">返回文档列表</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Bookmark */}
          <button onClick={toggleBookmark}
            className={`min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-3 text-[0.78rem] rounded-lg border transition-colors ${
              bookmarked ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600'
            }`}>
            <Star size={14} strokeWidth={1.5} fill={bookmarked ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">{bookmarked ? '已收藏' : '收藏'}</span>
          </button>

          {/* Edit / Preview toggle */}
          {canEdit && !usesPdfReader && (
            <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
              <button onClick={() => setTab('preview')}
                className={`min-h-[44px] px-4 text-[0.78rem] rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  tab === 'preview' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}>
                <Eye size={14} strokeWidth={1.5} /> <span className="hidden sm:inline">预览</span>
              </button>
              <button onClick={() => { setTab('edit'); setEditContent(doc.fullContent || doc.content || '') }}
                className={`min-h-[44px] px-4 text-[0.78rem] rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  tab === 'edit' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}>
                <Edit3 size={14} strokeWidth={1.5} /> <span className="hidden sm:inline">编辑</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Document meta ── */}
      <div className="mb-6 pb-6 border-b border-neutral-200">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[0.72rem] font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded">
            {catLabels[doc.category] || doc.category}
          </span>
          {doc.ownerDept && (
            <span className="text-[0.72rem] text-neutral-400">归属：{doc.ownerDept.name}</span>
          )}
          {doc.audiences?.length > 0 && (
            <span className="text-[0.72rem] text-neutral-400">适用：{doc.audiences.map(a => a.department.name).join('、')}</span>
          )}
          {canEdit && (
            <span className="text-[0.68rem] text-neutral-300 border border-neutral-200 px-2 py-0.5 rounded select-none">
              {tab === 'edit' ? '编辑中' : '可编辑'}
            </span>
          )}
          {!canEdit && (
            <span className="text-[0.68rem] text-neutral-300 border border-neutral-200 px-2 py-0.5 rounded select-none">只读</span>
          )}
        </div>
        <h1 className="text-[1.3rem] md:text-[1.7rem] font-semibold leading-[1.35] tracking-[-0.02em] text-neutral-900 mb-2">
          {doc.title}
        </h1>
        <p className="text-[0.78rem] md:text-[0.82rem] text-neutral-400">
          {doc.author?.name || '未知'} · {new Date(doc.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}

        </p>
      </div>

      {/* ── Content area ── */}
      {tab === 'preview' ? (
        /* ── Preview mode ── */
        usesPdfReader ? (
          doc.processingStatus === 'ready' ? (
            <PdfReader
              documentId={doc.id}
              title={doc.title}
              permission={readerPermission}
              fileType={doc.fileType}
            />
          ) : doc.processingStatus === 'processing' || doc.processingStatus === 'pending' ? (
            <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-center">
              <Loader2 className="size-7 animate-spin text-blue-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-neutral-700">正在生成在线预览</p>
                <p className="mt-1 text-xs text-neutral-400">PPT 转换可能需要几分钟，完成后刷新页面即可阅读。</p>
              </div>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 text-center">
              <p className="text-sm font-medium text-amber-900">暂时无法预览此文档</p>
              <p className="max-w-lg text-xs leading-relaxed text-amber-700">
                {canEdit ? (doc.processingError || '请重新上传文件；如果仍然失败，请联系系统管理员。') : '请联系文档管理员重新处理文件。'}
              </p>
              {canEdit && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/internal/documents"
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-300 bg-white px-4 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    返回并重新上传
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleFailedPreviewDownload()}
                    disabled={downloadingOriginal}
                    className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-800 px-4 text-sm font-medium text-white hover:bg-amber-900"
                  >
                    {downloadingOriginal ? '下载中…' : '下载原文件'}
                  </button>
                </div>
              )}
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            </div>
          )
        ) : (
          /* Markdown 文档：ReactMarkdown 渲染 */
          <article className="doc-content max-w-none overflow-x-auto">
            <div className="prose prose-neutral max-w-none
              prose-p:text-[15px] sm:prose-p:text-[0.92rem] prose-p:leading-relaxed prose-p:text-neutral-600 prose-p:font-normal prose-p:mb-4
              prose-h1:text-[1.25rem] sm:prose-h1:text-[1.35rem] prose-h1:font-semibold prose-h1:text-neutral-800 prose-h1:mt-10 prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b-2 prose-h1:border-neutral-200
              prose-h2:text-[1.1rem] sm:prose-h2:text-[1.15rem] prose-h2:font-semibold prose-h2:text-neutral-800 prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-[0.95rem] sm:prose-h3:text-[1rem] prose-h3:font-semibold prose-h3:text-neutral-700 prose-h3:mt-6 prose-h3:mb-2 prose-h3:pl-3 prose-h3:border-l-[3px] prose-h3:border-neutral-300
              prose-h4:text-[0.85rem] sm:prose-h4:text-[0.9rem] prose-h4:font-semibold prose-h4:text-neutral-700 prose-h4:mt-4 prose-h4:mb-2 prose-h4:px-3 prose-h4:py-1.5 prose-h4:bg-neutral-100 prose-h4:rounded
              prose-ul:mb-6 prose-ul:space-y-1
              prose-ol:mb-6 prose-ol:space-y-2 prose-ol:list-decimal prose-ol:list-inside prose-ol:marker:text-neutral-400
              prose-li:text-[15px] sm:prose-li:text-[0.92rem] prose-li:leading-[1.8] prose-li:text-neutral-600 prose-li:pl-1
              prose-strong:font-semibold prose-strong:text-neutral-800
              prose-table:my-6 prose-table:rounded-lg prose-table:border prose-table:border-neutral-200
              prose-th:border-b prose-th:border-neutral-200 prose-th:px-4 prose-th:py-2.5 prose-th:bg-neutral-50 prose-th:text-left prose-th:font-semibold prose-th:text-neutral-700 prose-th:text-[0.78rem]
              prose-td:border-b prose-td:border-neutral-100 prose-td:px-4 prose-td:py-2.5 prose-td:text-neutral-600
              prose-img:w-full prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg prose-img:border prose-img:border-neutral-200 prose-img:shadow-sm
              prose-code:bg-neutral-100 prose-code:text-neutral-600 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85rem] prose-code:font-mono
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayContent || '_暂无内容_'}
              </ReactMarkdown>
            </div>
          </article>
        )
      ) : (
        /* ── Edit mode ── */
        <div className="space-y-4">
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full min-h-[50vh] px-4 py-4 text-[15px] sm:text-[0.92rem] leading-relaxed text-neutral-700 font-normal border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 resize-y bg-white"
            placeholder="在此编辑 Markdown 内容..."
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="修改备注（可选）"
                className="w-full px-4 py-2.5 text-[0.82rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-900 bg-white"
              />
            </div>
            <div className="flex items-center gap-3">
              {saved && <Check size={16} className="text-emerald-500" />}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-[#2563EB] text-white text-[0.82rem] font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-[0.82rem] text-red-500">{error}</p>
          )}
        </div>
      )}
    </main>
  )
}
