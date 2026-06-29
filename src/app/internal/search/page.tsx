'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/internal/page-header'

interface SearchResult {
  id: string
  title: string
  snippet: string
  department: string
  category: string
  slug: string
  audienceSlug: string
}

const deptLabels: Record<string, string> = {
  '': '全部部门',
  '人事部': '人事部', '市场部': '市场部', '商品部': '商品部',
  '品牌部': '品牌部', '财务部': '财务部', '订货会': '订货会',
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    const params = new URLSearchParams({ q: query.trim() })
    if (department) params.set('department', department)
    try {
      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    }
    setLoading(false)
  }, [query, department])

  useEffect(() => {
    if (query.trim().length >= 2) {
      const timer = setTimeout(doSearch, 300)
      return () => clearTimeout(timer)
    }
  }, [query, department, doSearch])

  return (
    <div className="p-8 md:p-10 max-w-4xl">
      <PageHeader title="全文搜索" backTo="/internal/dashboard" backLabel="返回首页" />
      <div className="mb-8">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-neutral-900 mb-1">全文搜索</h1>
        <p className="text-[0.85rem] text-neutral-500 font-normal">搜索所有培训文档、SOP 和品牌资料。</p>
      </div>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="输入关键词搜索..."
          className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-[0.9rem] focus:outline-none focus:border-neutral-900 transition-colors font-normal"
          autoFocus
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2.5 border border-neutral-300 rounded-lg text-[0.85rem] bg-white focus:outline-none focus:border-neutral-900 transition-colors font-normal"
        >
          {Object.entries(deptLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          onClick={doSearch}
          className="px-6 py-2.5 bg-[#2563EB] text-white text-[0.85rem] font-medium rounded-lg hover:bg-blue-600 transition-colors"
        >
          搜索
        </button>
      </div>

      {/* Results */}
      {loading && <p className="text-[0.85rem] text-neutral-400 py-8 text-center">搜索中...</p>}

      {!loading && searched && results.length === 0 && (
        <p className="text-[0.85rem] text-neutral-400 py-8 text-center">未找到相关结果</p>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-[0.75rem] text-neutral-400 font-normal mb-4">{results.length} 条结果</p>
          <div className="space-y-3">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/internal/docs/${r.audienceSlug || 'marketing'}/${encodeURIComponent(r.slug)}`}
                className="block p-5 bg-white border border-neutral-200 rounded-xl hover:border-neutral-400 transition-colors no-underline"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <h3
                    className="text-[0.92rem] font-medium text-neutral-900"
                    dangerouslySetInnerHTML={{ __html: r.title }}
                  />
                  <span className="text-[0.65rem] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded font-normal">{r.department}</span>
                </div>
                <p
                  className="text-[0.82rem] leading-[1.7] text-neutral-500 font-normal"
                  dangerouslySetInnerHTML={{ __html: r.snippet }}
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
