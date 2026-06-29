'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

interface FaqItem {
  id: string
  question: string
  answer: string
  department: { name: string; slug: string }
  category: string
  order: number
}

interface Dept { id: string; name: string; slug: string }

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [activeDept, setActiveDept] = useState('all')
  const [activeType, setActiveType] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const typeLabels: Record<string, string> = { training: '培训资料', sop: 'SOP', reference: '企业制度', brand: '品牌资产' }

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDepts(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeDept !== 'all') params.set('department', activeDept)
    if (activeType) params.set('dtype', activeType)
    fetch(`/api/faq?${params}`)
      .then(r => r.json())
      .then(d => { setFaqs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [activeDept, activeType])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-3xl">
      <PageHeader title="FAQ 管理" backTo="/internal/dashboard" backLabel="返回首页" />
      <div className="mb-6">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.02em] text-neutral-900 mb-1">常见问题</h1>
        <p className="text-[0.82rem] text-neutral-500 font-normal">{faqs.length} 条问答</p>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="text-[0.65rem] text-neutral-400 font-medium mr-1">类型：</span>
        {Object.entries(typeLabels).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setActiveType(activeType === k ? '' : k)}
            className={`px-3 py-1.5 text-[0.72rem] rounded-md border transition-colors font-normal ${
              activeType === k ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Department tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setActiveDept('all')}
          className={`px-3 py-1.5 text-[0.72rem] rounded-md border transition-colors font-normal ${
            activeDept === 'all' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
          }`}
        >
          全部
        </button>
        {depts.map(d => (
          <button
            key={d.id}
            onClick={() => setActiveDept(d.slug)}
            className={`px-3 py-1.5 text-[0.72rem] rounded-md border transition-colors font-normal ${
              activeDept === d.slug ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* FAQ accordion */}
      {loading ? (
        <p className="text-[0.85rem] text-neutral-400 text-center py-12">加载中...</p>
      ) : (
        <div className="space-y-2">
          {faqs.map(faq => (
            <div key={faq.id} className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(faq.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[0.65rem] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0 font-normal">
                    {faq.department.name}
                  </span>
                  <span className="text-[0.85rem] font-normal text-neutral-800 truncate">{faq.question}</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 ml-2 text-neutral-400 transition-transform ${expanded.has(faq.id) ? 'rotate-180' : ''}`}
                />
              </button>
              {expanded.has(faq.id) && (
                <div className="px-4 pb-4 pt-0 border-t border-neutral-100">
                  <div className="mt-3 text-[0.85rem] leading-[1.8] text-neutral-700 font-normal prose-a:text-neutral-900 prose-a:underline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{faq.answer}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
