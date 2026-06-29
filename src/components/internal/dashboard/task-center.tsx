'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { fetchTasks, type Task } from '@/lib/dashboard/fetchers'
import { AIDrawer } from './ai-drawer'

function isToday(d: string | null | undefined): boolean {
  if (!d) return false
  return new Date(d).toDateString() === new Date().toDateString()
}

export function TaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [aiDocId, setAiDocId] = useState<string | null>(null)
  const [aiDocTitle, setAiDocTitle] = useState('')

  useEffect(() => {
    fetchTasks()
      .then(d => setTasks(d.tasks.filter(t => t.priority === 'high' || t.priority === 'medium')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const count = tasks.length

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-light text-gray-400 tracking-widest uppercase flex items-center gap-2">
          <span className="text-gray-300">🔥</span>
          我的任务
        </h2>
        {!loading && count > 0 && (
          <span className="text-xs font-light text-gray-300">待处理 {count}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-[72px] bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : !tasks.length ? (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-300 mb-3">
            <CheckCircle2 size={24} strokeWidth={1} />
          </div>
          <p className="text-sm text-gray-400 font-light">暂无待办事项</p>
          <Link
            href="/internal/documents"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline font-light"
          >
            浏览文档
          </Link>
        </div>
      ) : (
        <div>
          {tasks.map((t, i) => {
            const isLast = i === tasks.length - 1
            const dotColor = t.priority === 'high' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-yellow-400' : 'bg-gray-300'
            const progress = t.progress ?? 0
            const audienceSlug = t.doc?.audienceSlug || 'general'

            return (
              <div key={i} className={`flex gap-4 group py-4 ${i === 0 ? 'pt-0' : ''} border-b border-gray-100/80 ${isLast ? 'border-b-0' : ''}`}>
                {/* Timeline decoration */}
                <div className="flex flex-col items-center shrink-0">
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  {!isLast && <span className="w-px flex-1 bg-gray-200/60 mt-1" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-sm font-light text-gray-800 truncate">{t.reason || t.title}</h4>
                    <span className="text-xs text-gray-300 font-mono shrink-0 ml-3">{t.doc?.title || ''}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-0.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gray-300 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4 mt-2 text-xs text-gray-300">
                    <button
                      onClick={() => { setAiDocId(t.documentId); setAiDocTitle(t.doc?.title || t.title) }}
                      className="hover:text-gray-600 transition-colors duration-200 font-light"
                    >
                      速读摘要
                    </button>
                    <Link
                      href={`/internal/docs/${audienceSlug}/${encodeURIComponent(t.doc?.slug || '')}`}
                      className="hover:text-gray-600 transition-colors duration-200 no-underline font-light"
                    >
                      {t.actionLabel || '开始'} →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {aiDocId && <AIDrawer documentId={aiDocId} documentTitle={aiDocTitle} onClose={() => setAiDocId(null)} />}
    </section>
  )
}
