'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Mermaid } from '@/components/internal/mermaid-renderer'
import { Sparkles, CheckCircle2, RefreshCw, Search, AlertTriangle, ClipboardList } from 'lucide-react'

interface AnalysisMeta {
  documentType: string
  summary: string
  targetAudience: string[]
  estimatedReadMinutes: number
  riskAlerts: string[]
  integrityScore: number
  strengths: string[]
  weaknesses: string[]
}

interface ValidationResult {
  pass: boolean
  score: number
  issues: string[]
}

interface Props {
  documentId: string
  documentTitle: string
  documentCategory?: string
  originalContent: string
  onClose: () => void
  onApply: (draft: string) => Promise<void>
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

function scoreLabel(score: number): string {
  if (score >= 80) return '良好'
  if (score >= 60) return '一般'
  return '较差'
}

export function AiAnalyzer({ documentId, documentTitle, documentCategory, originalContent, onClose, onApply }: Props) {
  const [draft, setDraft] = useState('')
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null)
  const [extractedJson, setExtractedJson] = useState<any>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [showMetaDetail, setShowMetaDetail] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function analyze(fb?: string) {
    setLoading(true)
    setError('')
    setAnalysisMeta(null)
    try {
      const res = await fetch(`/api/documents/${documentId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: fb || '', documentType: documentCategory || '' }),
      })
      const data = await res.json()
      if (res.ok && data.draft) {
        setDraft(data.draft)
        if (data.analysisMeta) {
          setAnalysisMeta(data.analysisMeta)
        }
        if (data.extractedJson) {
          setExtractedJson(data.extractedJson)
        }
        if (data.validation) {
          setValidation(data.validation)
        }
      } else {
        setError(data.error || '解析失败')
      }
    } catch {
      setError('网络错误，请重试')
    }
    setLoading(false)
  }

  function startAnalyze() { analyze() }
  function regenerate() { analyze(feedback) }

  async function apply() {
    if (!draft) return
    setApplying(true)
    await onApply(draft)
    setApplying(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[4vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-[1400px] h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <h2 className="text-[0.95rem] font-semibold text-neutral-900 flex items-center gap-1.5">
            <Sparkles size={16} strokeWidth={1.5} className="text-neutral-900" />
            AI 解析 · {documentTitle}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">&times;</button>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── Left: Original (read-only) ── */}
          <div className="w-1/2 border-r border-neutral-200 flex flex-col">
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 shrink-0">
              <span className="text-[0.7rem] font-medium text-neutral-500 uppercase tracking-wider">原文（只读）</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <article className="prose prose-neutral max-w-none text-[0.85rem]">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  h1: ({ children }) => <h1 className="text-[1.1rem] font-semibold text-neutral-800 mt-6 mb-3">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-[1rem] font-semibold text-neutral-800 mt-5 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-[0.9rem] font-semibold text-neutral-700 mt-4 mb-2">{children}</h3>,
                  p: ({ children }) => <p className="text-[0.82rem] leading-[1.7] text-neutral-600 mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 space-y-0.5 list-decimal list-inside">{children}</ol>,
                  li: ({ children }) => <li className="text-[0.82rem] leading-[1.7] text-neutral-600">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-neutral-800">{children}</strong>,
                  img: ({ src, alt }) => src ? <img src={src.startsWith('/showroom/') ? src : src.startsWith('/') ? `/showroom${src}` : src} alt={alt || ''} className="max-w-full rounded my-3" /> : null,
                  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-[0.78rem] border-collapse border border-neutral-200">{children}</table></div>,
                  th: ({ children }) => <th className="border border-neutral-200 px-2 py-1 bg-neutral-50 text-left font-semibold text-neutral-700">{children}</th>,
                  td: ({ children }) => <td className="border border-neutral-200 px-2 py-1 text-neutral-600">{children}</td>,
                  code: ({ className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '')
                    if (match && match[1] === 'mermaid') return <Mermaid chart={String(children).replace(/\n$/, '')} />
                    return <code className="bg-neutral-100 px-1 py-0.5 rounded text-[0.8rem]" {...props}>{children}</code>
                  },
                }}>
                  {originalContent || '_暂无内容_'}
                </ReactMarkdown>
              </article>
            </div>
          </div>

          {/* ── Right: Draft (editable) + Meta ── */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 shrink-0 flex items-center justify-between">
              <span className="text-[0.7rem] font-medium text-neutral-500 uppercase tracking-wider">精简版草案</span>
              <div className="flex items-center gap-2">
                {draft && (
                  <>
                    <button onClick={apply} disabled={applying}
                      className="px-3 py-1 text-[0.7rem] font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {applying ? '保存中...' : <><CheckCircle2 size={14} strokeWidth={1.5} className="inline-block mr-1 -mt-0.5" /> 应用</>}
                    </button>
                    <button onClick={regenerate} disabled={loading}
                      className="px-3 py-1 text-[0.7rem] font-medium bg-[#2563EB] text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors">
                      {loading ? '生成中...' : <><RefreshCw size={14} strokeWidth={1.5} className="inline-block mr-1 -mt-0.5" /> 重新生成</>}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content area */}
            {!draft && !loading && !error ? (
              <div className="flex-1 flex items-center justify-center">
                <button onClick={startAnalyze}
                  className="px-6 py-3 bg-[#2563EB] text-white text-[0.85rem] font-medium rounded-lg hover:bg-blue-600 transition-colors">
                  <Sparkles size={16} strokeWidth={1.5} className="inline-block mr-1.5 -mt-0.5" /> 开始 AI 解析
                </button>
              </div>
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-[#2563EB] rounded-full mx-auto mb-3" />
                  <p className="text-[0.82rem] text-neutral-500">AI 正在分析文档，请稍候...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[0.85rem] text-red-500 mb-3">{error}</p>
                  <button onClick={startAnalyze} className="px-4 py-2 text-[0.78rem] bg-[#2563EB] text-white rounded-md hover:bg-blue-600">重试</button>
                </div>
              </div>
            ) : (
              <>
                {/* Editor + Preview */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      className="flex-1 w-full px-4 py-3 border-b border-neutral-200 text-[0.8rem] leading-relaxed focus:outline-none font-mono resize-none"
                      placeholder="AI 生成的草案将显示在这里..."
                    />
                    {/* Live preview */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 bg-neutral-50/50">
                      <p className="text-[0.65rem] text-neutral-400 uppercase tracking-wider mb-2">预览</p>
                      <article className="prose prose-neutral max-w-none text-[0.82rem]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          h1: ({ children }) => <h1 className="text-[1rem] font-semibold text-neutral-800 mt-4 mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-[0.92rem] font-semibold text-neutral-800 mt-3 mb-1.5">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-[0.85rem] font-semibold text-neutral-700 mt-3 mb-1">{children}</h3>,
                          p: ({ children }) => <p className="text-[0.78rem] leading-[1.6] text-neutral-600 mb-2">{children}</p>,
                          ul: ({ children }) => <ul className="mb-2 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-2 space-y-0.5 list-decimal list-inside">{children}</ol>,
                          li: ({ children }) => <li className="text-[0.78rem] leading-[1.6] text-neutral-600">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-neutral-800">{children}</strong>,
                          table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-[0.72rem] border-collapse border border-neutral-200">{children}</table></div>,
                          th: ({ children }) => <th className="border border-neutral-200 px-2 py-1 bg-neutral-50 text-left font-semibold text-neutral-700">{children}</th>,
                          td: ({ children }) => <td className="border border-neutral-200 px-2 py-1 text-neutral-600">{children}</td>,
                          code: ({ className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '')
                            if (match && match[1] === 'mermaid') return <Mermaid chart={String(children).replace(/\n$/, '')} />
                            return <code className="bg-neutral-100 px-1 py-0.5 rounded text-[0.75rem]" {...props}>{children}</code>
                          },
                        }}>
                          {draft || '_空内容_'}
                        </ReactMarkdown>
                      </article>
                    </div>
                  </div>
                </div>

                {/* ── Phase 1: Structure Extraction ── */}
                {extractedJson && (
                  <div className="px-4 py-2 border-t border-neutral-200 bg-blue-50/50 shrink-0">
                    <div className="flex items-center gap-2 text-[0.7rem] text-blue-700">
                      <Search size={12} strokeWidth={1.5} className="inline-block mr-1 -mt-0.5 text-blue-700" />
                      <span>结构提取：</span>
                      <span>{extractedJson.steps?.length || 0} 步骤</span>
                      {extractedJson.applicableDepartments?.length > 0 && (
                        <span>· {extractedJson.applicableDepartments.join(', ')}</span>
                      )}
                      {extractedJson.riskPoints?.length > 0 && (
                        <span>· {extractedJson.riskPoints.length} 风险点</span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Analysis Meta Card ── */}
                {analysisMeta && (
                  <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0 space-y-2">
                    {/* Score bar */}
                    <div className="flex items-center gap-3">
                      <span className={`text-[0.72rem] font-semibold px-2.5 py-1 rounded-md border ${scoreColor(analysisMeta.integrityScore)}`}>
                        完整性 {analysisMeta.integrityScore}/100 · {scoreLabel(analysisMeta.integrityScore)}
                      </span>
                      <span className="text-[0.7rem] text-neutral-500">{analysisMeta.summary}</span>
                      <button
                        onClick={() => setShowMetaDetail(!showMetaDetail)}
                        className="text-[0.7rem] text-neutral-400 hover:text-neutral-700 ml-auto shrink-0"
                      >
                        {showMetaDetail ? '收起详情 ▲' : '展开详情 ▼'}
                      </button>
                    </div>

                    {/* Expandable detail */}
                    {showMetaDetail && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {/* Risk alerts */}
                        <div>
                          <p className="text-[0.65rem] font-medium text-amber-700 mb-1">
                            <AlertTriangle size={12} strokeWidth={1.5} className="inline-block mr-1 -mt-0.5 text-amber-700" /> 风险提示 ({analysisMeta.riskAlerts.length})
                          </p>
                          {analysisMeta.riskAlerts.length > 0 ? (
                            <ul className="space-y-0.5">
                              {analysisMeta.riskAlerts.map((r, i) => (
                                <li key={i} className="text-[0.68rem] text-amber-700 leading-relaxed">· {r}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[0.68rem] text-neutral-400">暂未发现明显风险</p>
                          )}
                        </div>

                        {/* Strengths & Weaknesses */}
                        <div>
                          {analysisMeta.strengths.length > 0 && (
                            <div className="mb-2">
                              <p className="text-[0.65rem] font-medium text-emerald-700 mb-1 flex items-center gap-1">
                                <CheckCircle2 size={12} strokeWidth={1.5} className="text-emerald-700" /> 优势
                              </p>
                              <ul className="space-y-0.5">
                                {analysisMeta.strengths.map((s, i) => (
                                  <li key={i} className="text-[0.68rem] text-emerald-700 leading-relaxed">· {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {analysisMeta.weaknesses.length > 0 && (
                            <div>
                              <p className="text-[0.65rem] font-medium text-neutral-600 mb-1 flex items-center gap-1">
                                <ClipboardList size={12} strokeWidth={1.5} className="text-neutral-600" /> 待改进
                              </p>
                              <ul className="space-y-0.5">
                                {analysisMeta.weaknesses.map((w, i) => (
                                  <li key={i} className="text-[0.68rem] text-neutral-500 leading-relaxed">· {w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Validator Panel ── */}
                {validation && (
                  <div className="px-4 py-2 border-t border-neutral-200 bg-white shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[0.7rem] font-semibold px-2 py-0.5 rounded ${validation.pass ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {validation.pass ? <><CheckCircle2 size={12} strokeWidth={1.5} className="inline-block mr-1 -mt-0.5" /> 质检通过</> : <><AlertTriangle size={12} strokeWidth={1.5} className="inline-block mr-1 -mt-0.5" /> 需关注</>} · {validation.score}分
                      </span>
                      <span className="text-[0.65rem] text-neutral-400">{validation.issues.length} 个问题</span>
                    </div>
                    {validation.issues.length > 0 && (
                      <div className="text-[0.68rem] text-neutral-600 space-y-0.5 max-h-[100px] overflow-y-auto">
                        {validation.issues.map((issue, i) => (
                          <p key={i} className="leading-relaxed">· {issue}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback row */}
                <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0 flex items-center gap-3">
                  <span className="text-[0.7rem] text-neutral-500 shrink-0">修改意见：</span>
                  <input
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') regenerate() }}
                    placeholder="输入额外要求后点击重新生成..."
                    className="flex-1 px-3 py-1.5 border border-neutral-300 rounded-md text-[0.78rem] focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
