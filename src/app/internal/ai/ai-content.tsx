'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Lightbulb, ClipboardList, Wrench, FileText, Search } from 'lucide-react'
import { AIAnswerCard } from '@/components/internal/ai-answer-card'
import { SourceCitation } from '@/components/internal/ai-source-citation'
import type { SourceMeta } from '@/components/internal/ai-source-citation'
import { RelatedKnowledge } from '@/components/internal/ai-related-knowledge'
import { AIFeedbackBar } from '@/components/internal/ai-feedback-bar'
import { PageHeader } from '@/components/internal/page-header'

type PageState = 'idle' | 'loading' | 'streaming' | 'done'
type Intent = 'question' | 'sop' | 'howto' | 'document'

const QUICK_PROMPTS = [
  '如何审核订单？',
  '云仓、现货、期货订单处理有什么区别？',
  '回款登记怎么做？',
  '每月核算流程是怎样的？',
  '商品档案怎么新建？',
  '怎么看某个品牌的确认订单？',
]

const INTENT_ICONS: Record<string, { icon: any; label: string }> = {
  question: { icon: Lightbulb, label: '知识问答' },
  sop: { icon: ClipboardList, label: '流程指引' },
  howto: { icon: Wrench, label: '操作步骤' },
  document: { icon: FileText, label: '文档检索' },
}

function detectIntent(answer: string, question: string): Intent {
  const combined = (question + ' ' + answer).toLowerCase()
  if (/步骤|操作|点击|进入|打开|选择|查询|导出/.test(combined)) return 'howto'
  if (/流程|审批|审核|环节|节点|提交|通过/.test(combined)) return 'sop'
  if (/什么|如何|怎么|为什么|是什么|含义/.test(combined)) return 'question'
  return 'document'
}

function AIPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [state, setState] = useState<PageState>('idle')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<SourceMeta[]>([])
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([])
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load history
  useEffect(() => {
    try {
      const saved = localStorage.getItem('yuan_ai_history')
      if (saved) setHistory(JSON.parse(saved).slice(0, 10))
    } catch {}
  }, [])

  // Handle URL q param
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      doSearch(q)
    }
  }, [searchParams])

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (state === 'streaming' && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [answer, state])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const addToHistory = (q: string) => {
    setHistory(prev => {
      const updated = [q, ...prev.filter(h => h !== q)].slice(0, 10)
      localStorage.setItem('yuan_ai_history', JSON.stringify(updated))
      return updated
    })
  }

  const doSearch = useCallback(async (q?: string) => {
    const question = (q || query).trim()
    if (!question || question.length < 2 || state === 'loading' || state === 'streaming') return

    // Abort previous
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setAnswer('')
    setSources([])
    setRelatedQuestions([])
    setError('')
    setState('loading')
    addToHistory(question)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || `请求失败 (${res.status})`)
        setState('done')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullAnswer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'meta') {
              setSources(parsed.sources || [])
            } else if (parsed.type === 'token') {
              fullAnswer += parsed.content
              setAnswer(fullAnswer)
              setState('streaming')
            } else if (parsed.type === 'related') {
              setRelatedQuestions(parsed.questions || [])
            } else if (parsed.type === 'error') {
              setError(parsed.content)
            }
          } catch { /* skip malformed */ }
        }
      }

      setState('done')
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('网络错误，请重试')
      }
      setState('done')
    }
  }, [query, state])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch()
  }

  const handleAsk = (q: string) => {
    setQuery(q)
    router.push(`/internal/ai?q=${encodeURIComponent(q)}`, { scroll: false })
    setTimeout(() => doSearch(q), 50)
  }

  const isActive = state !== 'idle'

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="AI 知识助手" backTo="/internal/dashboard" backLabel="返回首页" />
      {/* ═══ Header ═══ */}
      <div className="mb-8">
        <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111] mb-1">
          AI 知识助手
        </h1>
        <p className="text-[0.85rem] text-neutral-500">
          基于知识库文档的智能问答，支持操作指引、流程查询、政策解读
        </p>
      </div>

      {/* ═══ Search Bar ═══ */}
      <form onSubmit={handleSubmit} className={`mb-8 transition-all ${isActive ? '' : ''}`}>
        <div className="flex items-center bg-white border border-neutral-200 rounded-2xl shadow-sm focus-within:border-neutral-400 focus-within:shadow-md transition-all overflow-hidden">
          {isActive && (
            <span className="pl-4 shrink-0">
              {(() => { const matched = INTENT_ICONS[detectIntent(answer, query)]; const Icon = matched?.icon || Search; return <Icon size={15} strokeWidth={1.5} className="text-neutral-400" /> })()}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="输入问题，例如：如何审核回款单？"
            disabled={state === 'loading' || state === 'streaming'}
            className="flex-1 px-4 py-4 text-[0.95rem] text-[#111] bg-transparent border-none outline-none placeholder:text-neutral-400 disabled:opacity-60"
          />
          {(state === 'loading' || state === 'streaming') ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="mr-2 px-4 py-2 text-[0.72rem] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!query.trim()}
              className="mr-2 px-5 py-2 bg-[#2563EB] text-white text-[0.78rem] font-medium rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-all"
            >
              提问
            </button>
          )}
        </div>
      </form>

      {/* ═══ Idle State: Quick Prompts + History ═══ */}
      {!isActive && (
        <>
          {/* Quick Prompts */}
          <div className="mb-8">
            <p className="text-[0.72rem] font-medium text-neutral-400 uppercase tracking-[0.06em] mb-3">
              常见问题
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => handleAsk(p)}
                  className="text-left px-4 py-3 text-[0.82rem] text-neutral-600 bg-white border border-neutral-200 rounded-xl hover:border-neutral-400 hover:text-neutral-900 hover:shadow-sm transition-all font-normal"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Search History */}
          {history.length > 0 && (
            <div>
              <p className="text-[0.72rem] font-medium text-neutral-400 uppercase tracking-[0.06em] mb-3">
                最近搜索
              </p>
              <div className="space-y-1">
                {history.slice(0, 5).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(h)}
                    className="block w-full text-left px-4 py-2.5 text-[0.82rem] text-neutral-500 hover:bg-white hover:text-neutral-800 rounded-lg transition-colors"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Active State: Answer + Sources + Related + Feedback ═══ */}
      {isActive && (
        <div className="space-y-5">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <p className="text-[0.85rem] text-red-700">{error}</p>
              <button
                onClick={() => { setError(''); setState('idle'); setAnswer(''); setSources([]) }}
                className="mt-3 text-[0.78rem] text-red-600 hover:text-red-800 font-medium"
              >
                ← 重新提问
              </button>
            </div>
          )}

          {/* Answer Card */}
          {(answer || state === 'loading') && (
            <AIAnswerCard
              question={query}
              answer={answer}
              loading={state === 'loading'}
              streaming={state === 'streaming'}
            />
          )}

          {/* Source Citations */}
          {sources.length > 0 && state !== 'loading' && (
            <SourceCitation sources={sources} />
          )}

          {/* Related Knowledge */}
          {(relatedQuestions.length > 0 || sources.length > 0) && state === 'done' && (
            <RelatedKnowledge
              questions={relatedQuestions}
              documents={sources.slice(0, 3)}
              onAsk={handleAsk}
            />
          )}

          {/* Feedback Bar */}
          {answer && state === 'done' && (
            <AIFeedbackBar answer={answer} question={query} />
          )}

          {/* Bottom anchor for auto-scroll */}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ═══ Bottom: Continue asking ═══ */}
      {state === 'done' && (
        <div className="mt-8 pt-6 border-t border-neutral-100">
          <p className="text-[0.72rem] text-neutral-400 mb-3 font-medium">
            继续追问
          </p>
          <form
            onSubmit={e => {
              e.preventDefault()
              const input = (e.target as HTMLFormElement).querySelector('input')
              if (input) {
                setQuery(input.value)
                doSearch(input.value)
                input.value = ''
              }
            }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入追问内容..."
                className="flex-1 px-4 py-3 border border-neutral-200 rounded-xl text-[0.85rem] focus:outline-none focus:border-neutral-400 transition-colors placeholder:text-neutral-400"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-[#2563EB] text-white text-[0.78rem] font-medium rounded-xl hover:bg-blue-600 transition-colors shrink-0"
              >
                发送
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default AIPageContent
