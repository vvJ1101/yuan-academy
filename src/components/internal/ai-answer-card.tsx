'use client'

import { Lightbulb } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  question: string
  answer: string
  loading?: boolean
  streaming?: boolean
}

/** Parse the AI answer to extract a display title from the first markdown bold line */
function parseAnswer(answer: string): { title: string; body: string } {
  const lines = answer.split('\n')
  // Try to extract the first bold heading as title
  const titleMatch = answer.match(/^\*\*(.+?)\*\*/)
  if (titleMatch) {
    const title = titleMatch[1].trim()
    const body = answer.replace(/^\*\*(.+?)\*\*\n?\n?/, '')
    return { title, body }
  }
  // If no bold title, use first line as title if it's short
  if (lines[0] && lines[0].trim().length < 60 && !lines[0].startsWith('#')) {
    return { title: lines[0].trim().replace(/^#+\s*/, ''), body: lines.slice(1).join('\n').trim() }
  }
  return { title: '', body: answer }
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 bg-neutral-200 rounded w-1/3" />
      <div className="space-y-2">
        <div className="h-4 bg-neutral-100 rounded w-full" />
        <div className="h-4 bg-neutral-100 rounded w-5/6" />
        <div className="h-4 bg-neutral-100 rounded w-4/6" />
      </div>
    </div>
  )
}

export function AIAnswerCard({ question, answer, loading, streaming }: Props) {
  if (loading && !answer) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8">
        <LoadingSkeleton />
      </div>
    )
  }

  if (!answer) return null

  const { title, body } = parseAnswer(answer)

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8">
      {/* Question display */}
      <div className="mb-6">
        <p className="text-[0.68rem] font-medium text-neutral-400 uppercase tracking-[0.08em] mb-2">
          你的问题
        </p>
        <p className="text-[0.95rem] text-neutral-900 font-medium leading-relaxed">
          {question}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-100 mb-6" />

      {/* Answer */}
      <div>
        <p className="text-[0.68rem] font-medium text-neutral-400 uppercase tracking-[0.08em] mb-3">
          AI 回答
        </p>

        {title && (
          <h2 className="text-[1.15rem] font-semibold text-neutral-900 leading-snug mb-4 tracking-[-0.01em]">
            {title}
          </h2>
        )}

        <div className="prose prose-neutral max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-[1.1rem] font-semibold text-neutral-800 mt-6 mb-3">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-[1rem] font-semibold text-neutral-800 mt-5 mb-2">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-[0.92rem] font-semibold text-neutral-700 mt-4 mb-2 pl-3 border-l-[3px] border-neutral-300">{children}</h3>
              ),
              p: ({ children }) => {
                const text = String(children)
                // Highlight 💡 tip blocks
                if (text.startsWith('💡')) {
                  return (
                    <div className="my-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[0.85rem] text-amber-800 leading-relaxed flex gap-2">
                      <Lightbulb size={16} strokeWidth={1.5} className="shrink-0 mt-0.5 text-amber-800" />
                      <span>{text.replace(/^💡\s*/, '')}</span>
                    </div>
                  )
                }
                return <p className="text-[0.88rem] leading-[1.85] text-neutral-600 font-normal mb-4">{children}</p>
              },
              ol: ({ children }) => (
                <ol className="mb-5 space-y-2 list-decimal list-inside marker:text-neutral-400 marker:font-medium">{children}</ol>
              ),
              ul: ({ children }) => (
                <ul className="mb-5 space-y-1.5 list-disc list-inside marker:text-neutral-300">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="text-[0.88rem] leading-[1.8] text-neutral-600 pl-1">{children}</li>
              ),
              strong: ({ children }) => {
                const text = String(children)
                // If it looks like a reference source marker (e.g., "参考来源" or "来源")
                if (text.includes('来源') || text.includes('参考')) {
                  return <strong className="font-medium text-neutral-400 text-[0.78rem]">{children}</strong>
                }
                return <strong className="font-semibold text-neutral-800">{children}</strong>
              },
              em: ({ children }) => (
                <em className="text-neutral-500 italic">{children}</em>
              ),
              code: ({ children }) => (
                <code className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded text-[0.82rem] font-mono">
                  {children}
                </code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-neutral-300 pl-4 my-4 text-neutral-500 italic text-[0.85rem]">
                  {children}
                </blockquote>
              ),
            }}
          >
            {body}
          </ReactMarkdown>
        </div>

        {/* Streaming cursor */}
        {streaming && (
          <span className="inline-block w-2 h-4 bg-neutral-400 animate-pulse ml-0.5 align-middle rounded-sm" />
        )}
      </div>
    </div>
  )
}
