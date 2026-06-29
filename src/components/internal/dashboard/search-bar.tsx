'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'
import type { ASR } from '@/types/dashboard'

interface Props {
  onResultSelect?: () => void
}

export function SearchBar({ onResultSelect }: Props) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [aiResult, setAiResult] = useState<ASR | null>(null)
  const [showDD, setShowDD] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setAiResult(null)
      setShowDD(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      })
      const r = await res.json()
      if (res.ok) {
        setAiResult(r)
        setShowDD(true)
      }
    } catch { /* */ }
    setSearching(false)
  }, [])

  const handleChange = (v: string) => {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 300)
  }

  useEffect(() => {
    function h(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDD(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  return (
    <div className="relative group mb-10" ref={containerRef}>
      <div className={`flex items-center gap-2 border-b-2 transition-all duration-200 ${
        showDD
          ? 'border-blue-600 shadow-[0_1px_0_#2563EB]'
          : 'border-gray-200/80 focus-within:border-blue-600 focus-within:shadow-[0_1px_0_#2563EB]'
      }`}>
        <Search size={16} strokeWidth={1} className="text-gray-300 group-focus-within:text-blue-600 transition-colors shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (aiResult) setShowDD(true) }}
          placeholder="搜文档、搜制度、搜流程..."
          className="w-full py-3 text-sm font-light bg-transparent outline-none placeholder:text-gray-300"
        />
        {searching ? (
          <span className="text-[10px] text-gray-300 mr-2">…</span>
        ) : (
          <span className="text-[10px] font-mono text-gray-300 bg-gray-100/50 px-2 py-0.5 rounded border border-gray-200/50 mr-2">
            ⌘K
          </span>
        )}
        <button
          onClick={() => doSearch(query)}
          className={`text-sm font-light text-blue-600 transition-opacity duration-200 shrink-0 ${
            query ? 'opacity-100' : 'opacity-0'
          }`}
        >
          搜索
        </button>
      </div>

      {/* Dropdown */}
      {showDD && aiResult && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-md shadow-sm z-30 overflow-hidden">
          {aiResult.summary && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm text-gray-600 font-light">{aiResult.summary}</p>
            </div>
          )}
          {aiResult.documents.length > 0 ? (
            <div className="py-1">
              {aiResult.documents.map(d => (
                <a
                  key={d.id}
                  href={`/internal/docs/${d.audienceSlug || 'general'}/${encodeURIComponent(d.slug)}`}
                  onClick={() => { setShowDD(false); onResultSelect?.() }}
                  className="flex justify-between px-5 py-3 hover:bg-gray-50 transition-colors no-underline"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate font-light">{d.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{d.snippet || d.department}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded ml-3 shrink-0">{d.category}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-gray-400 text-center font-light">未找到相关文档</p>
          )}
        </div>
      )}
    </div>
  )
}
