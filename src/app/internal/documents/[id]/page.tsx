'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, Eye, Edit3, Save, Star, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Doc {
  id: string; title: string; slug: string; content: string; fullContent: string; condensedContent: string
  displayMode: string; category: string; ownerDeptId: string
  ownerDept: { name: string; slug: string } | null
  audiences: { id: string; departmentId: string; department: { name: string; slug: string } }[]
  author: { name: string }; updatedAt: string
  userPermission: string | null
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
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [bookmarked, setBookmarked] = useState(false)
  const [history, setHistory] = useState<any[]>([])
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
      .catch(() => {})
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
          {canEdit && (
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
      ) : (
        /* ── Edit mode ── */
        <div className="space-y-4">
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full min-h-[50vh] px-4 py-4 text-[15px] sm:text-[0.92rem] leading-relaxed text-neutral-700 font-normal border border-neutral-300 rounded-xl focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 resize-y bg-white"
            placeholder="在此编辑 Markdown 内容..."
          />

          {/* Remark + Save */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="更新说明（可选）"
              className="flex-1 min-h-[44px] px-3 py-2 text-[0.85rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 bg-[#2563EB] text-white text-[0.82rem] font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              {saving ? (
                <><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> 保存中...</>
              ) : saved ? (
                <><Check size={14} strokeWidth={1.5} /> 已保存</>
              ) : (
                <><Save size={14} strokeWidth={1.5} /> 保存</>
              )}
            </button>
          </div>

          {error && (
            <p className="text-[0.82rem] text-red-500">{error}</p>
          )}

          {/* Edit hint */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-[0.72rem] text-amber-700 font-normal">
              编辑内容使用 Markdown 格式。保存后会自动创建历史版本记录。修改后直接覆写正文内容，不会触发文档解析管线。
            </p>
          </div>
        </div>
      )}

      {/* ── History panel ── */}
      {(tab === 'preview') && (
        <div className="mt-10 pt-6 border-t border-neutral-200">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-[0.82rem] font-medium text-neutral-500 hover:text-neutral-800 transition-colors min-h-[44px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            编辑历史 {history.length > 0 && <span className="text-[0.68rem] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{history.length}</span>}
            <span className="text-[0.68rem] text-neutral-300">{showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && (
            <div className="mt-4 space-y-3">
              {!historyLoaded ? (
                <p className="text-[0.78rem] text-neutral-400">加载中...</p>
              ) : history.length === 0 ? (
                <p className="text-[0.78rem] text-neutral-400">暂无编辑记录。保存修改后会自动生成版本快照。</p>
              ) : (
                history.map((h: any, idx: number) => (
                  <details key={h.id || idx} className="group border border-neutral-200 rounded-xl overflow-hidden">
                    <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 list-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                      <span className="text-[0.78rem] text-neutral-700 font-medium">{h.editorName}</span>
                      <span className="text-[0.72rem] text-neutral-400">{new Date(h.createdAt).toLocaleString('zh-CN')}</span>
                      {h.remark && <span className="text-[0.72rem] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{(h.remark as string).slice(0, 50)}</span>}
                      <span className="text-[0.65rem] text-neutral-300 ml-auto">{idx === history.length - 1 ? '初始版本' : '#' + (history.length - idx)}</span>
                    </summary>
                    <div className="px-4 pb-4 border-t border-neutral-100 pt-3">
                      <pre className="text-[0.78rem] text-neutral-600 whitespace-pre-wrap font-normal leading-relaxed max-h-[300px] overflow-y-auto bg-neutral-50 p-3 rounded-lg">{h.content}</pre>
                    </div>
                  </details>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
