'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

interface SOPDoc {
  id: string; title: string; slug: string; category: string
  documentType: string; processStage: string | null; riskLevel: string | null
  ownerDept: { name: string; slug: string }
  audiences: { department: { slug: string } }[]
  updatedAt: string
}

interface SOPData {
  docs: SOPDoc[]
  byStage: Record<string, SOPDoc[]>
  total: number
}

const stageLabels: Record<string, string> = {
  order: '订单处理', payment: '回款管理', shipping: '发货物流',
  audit: '审核流程', onboarding: '入职培训', other: '其他流程',
}
const riskColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50', medium: 'text-amber-600 bg-amber-50', low: 'text-emerald-600 bg-emerald-50',
}

export default function SOPPage() {
  const [data, setData] = useState<SOPData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sop')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#2563EB]" /></div>
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <PageHeader title="SOP 流程" backTo="/internal/dashboard" backLabel="返回首页" />
      <div className="mb-8">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-neutral-900 mb-1 flex items-center gap-2"><ClipboardList size={22} strokeWidth={1.5} className="text-[#2563EB]" />SOP 流程库</h1>
        <p className="text-[0.85rem] text-neutral-500">{data?.total || 0} 个业务流程</p>
      </div>

      {/* By Stage */}
      {data?.byStage && Object.keys(data.byStage).length > 0 ? (
        Object.entries(data.byStage).map(([stage, docs]) => (
          <section key={stage} className="mb-8">
            <h2 className="text-[0.9rem] font-semibold text-neutral-800 mb-3">{stageLabels[stage] || stage}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {docs.map(d => (
                <Link
                  key={d.id}
                  href={`/internal/docs/${d.audiences?.[0]?.department?.slug || d.ownerDept.slug}/${encodeURIComponent(d.slug)}`}
                  className="flex items-start justify-between bg-white border border-neutral-200/80 rounded-xl px-5 py-4 hover:border-neutral-400 hover:shadow-sm transition-all no-underline group"
                >
                  <div className="min-w-0">
                    <p className="text-[0.85rem] text-neutral-800 font-medium group-hover:text-neutral-900 truncate">{d.title}</p>
                    <p className="text-[0.72rem] text-neutral-400 mt-1">{d.ownerDept.name} · {d.category}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {d.riskLevel && (
                      <span className={`text-[0.65rem] px-2 py-0.5 rounded-full ${riskColors[d.riskLevel] || ''}`}>
                        {d.riskLevel === 'high' ? '高风险' : d.riskLevel === 'medium' ? '中风险' : '低风险'}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="text-center py-16">
          <p className="text-[0.9rem] text-neutral-400">暂无 SOP 流程文档</p>
          <p className="text-[0.78rem] text-neutral-400 mt-1">上传文档时将分类设为 "SOP" 即可在此展示</p>
        </div>
      )}
    </div>
  )
}
