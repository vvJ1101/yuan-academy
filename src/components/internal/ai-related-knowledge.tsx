'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { SourceMeta } from './ai-source-citation'

interface Props {
  questions?: string[]
  documents?: SourceMeta[]
  onAsk?: (question: string) => void
}

export function RelatedKnowledge({ questions, documents, onAsk }: Props) {
  if ((!questions || questions.length === 0) && (!documents || documents.length === 0)) {
    return null
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8">
      {/* Related Questions */}
      {questions && questions.length > 0 && (
        <div className="mb-6">
          <p className="text-[0.68rem] font-medium text-neutral-400 uppercase tracking-[0.08em] mb-3">
            相关问题
          </p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, i) => (
              <button
                key={i}
                onClick={() => onAsk?.(q)}
                className="text-left px-3.5 py-2 text-[0.8rem] text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 transition-all font-normal"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Related Documents */}
      {documents && documents.length > 0 && (
        <div>
          <p className="text-[0.68rem] font-medium text-neutral-400 uppercase tracking-[0.08em] mb-3">
            相关文档
          </p>
          <div className="space-y-1.5">
            {documents.map(doc => (
              <Link
                key={doc.id}
                href={`/internal/docs/${doc.audienceSlug}/${encodeURIComponent(doc.slug)}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors no-underline group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0 text-neutral-500"><FileText size={15} strokeWidth={1.5} /></span>
                  <span className="text-[0.82rem] text-neutral-700 truncate group-hover:text-neutral-900 transition-colors">
                    {doc.title}
                  </span>
                </div>
                <span className="text-[0.68rem] text-neutral-400 shrink-0 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  查看 →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
