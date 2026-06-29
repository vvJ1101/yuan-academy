'use client'

import { useEffect, useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/internal/page-header'

interface DocRef { id: string; title: string; slug: string; category?: string; updatedAt?: string; ownerDept?: { name: string; slug?: string }; audiences?: { department?: { slug?: string } }[]; audienceSlug?: string; department?: string }

function slug(d: DocRef) { return d.audiences?.[0]?.department?.slug || d.audienceSlug || d.ownerDept?.slug || 'general' }

export default function RecentPage() {
  const [views, setViews] = useState<DocRef[]>([])
  const [updates, setUpdates] = useState<DocRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/workspace/activity').then(r=>r.json()).then(d=>{
      setViews(d?.recentViews||[]); setUpdates(d?.recentUpdates||[])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-neutral-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="最近访问" backTo="/internal/dashboard" backLabel="返回首页" />
      <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111] mb-1 flex items-center gap-2"><Clock size={22} strokeWidth={1.5} className="text-[#111]" />最近访问</h1>
      <p className="text-[0.85rem] text-neutral-500 mb-8">最近查看的文档与最新更新</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Views */}
        <section>
          <h2 className="text-[0.85rem] font-semibold text-[#111] mb-4">最近查看</h2>
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {views.length>0?views.slice(0,10).map((d,i)=>(
              <Link key={d.id} href={`/internal/docs/${slug(d)}/${encodeURIComponent(d.slug)}`} className={`flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 transition-colors no-underline ${i>0?'border-t border-neutral-100':''}`}>
                <div className="min-w-0"><p className="text-[0.88rem] text-[#111] truncate">{d.title}</p><p className="text-[0.72rem] text-neutral-400 mt-1">{d.ownerDept?.name||d.department||''} · {d.category||''}</p></div>
              </Link>
            )):<p className="px-5 py-10 text-[0.85rem] text-neutral-400 text-center">暂无查看记录</p>}
          </div>
        </section>

        {/* Updates */}
        <section>
          <h2 className="text-[0.85rem] font-semibold text-[#111] mb-4">最近更新</h2>
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {updates.length>0?updates.slice(0,10).map((d,i)=>(
              <Link key={d.id} href={`/internal/docs/${slug(d)}/${encodeURIComponent(d.slug)}`} className={`flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 transition-colors no-underline ${i>0?'border-t border-neutral-100':''}`}>
                <div className="min-w-0"><p className="text-[0.88rem] text-[#111] truncate">{d.title}</p><p className="text-[0.72rem] text-neutral-400 mt-1">{d.ownerDept?.name||d.department||''} · {d.updatedAt?new Date(d.updatedAt).toLocaleDateString('zh-CN'):''}</p></div>
              </Link>
            )):<p className="px-5 py-10 text-[0.85rem] text-neutral-400 text-center">暂无更新</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
