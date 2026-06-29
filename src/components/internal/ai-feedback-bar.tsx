'use client'

import { useState } from 'react'

interface Props {
  answer: string
  question: string
}

type FeedbackType = 'helpful' | 'not-helpful' | null

export function AIFeedbackBar({ answer, question }: Props) {
  const [feedback, setFeedback] = useState<FeedbackType>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/internal/ai?q=${encodeURIComponent(question)}`
      await navigator.clipboard.writeText(url)
    } catch { /* clipboard not available */ }
  }

  const handleFeedback = (type: FeedbackType) => {
    setFeedback(type)
    // Could send to analytics endpoint
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Helpful */}
      <button
        onClick={() => handleFeedback(feedback === 'helpful' ? null : 'helpful')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium rounded-lg transition-all ${
          feedback === 'helpful'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 border border-transparent'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
        </svg>
        有帮助
      </button>

      {/* Not helpful */}
      <button
        onClick={() => handleFeedback(feedback === 'not-helpful' ? null : 'not-helpful')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium rounded-lg transition-all ${
          feedback === 'not-helpful'
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 border border-transparent'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
        </svg>
        没帮助
      </button>

      {/* Separator */}
      <span className="w-px h-4 bg-neutral-200 mx-1" />

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-all border border-transparent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {copied ? '已复制' : '复制答案'}
      </button>

      {/* Share link */}
      <button
        onClick={handleCopyLink}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-all border border-transparent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        复制链接
      </button>

      {/* Continue asking hint */}
      <span className="text-[0.68rem] text-neutral-300 ml-2">
        继续在下方输入问题追问
      </span>
    </div>
  )
}
