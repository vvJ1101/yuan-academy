'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Star } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

interface DocRef { id: string; title: string; slug: string; category?: string; department?: string; ownerDept?: { name: string; slug?: string }; audiences?: { department?: { slug?: string } }[]; audienceSlug?: string }

function slug(d: DocRef) { return d.audiences?.[0]?.department?.slug || d.audienceSlug || d.ownerDept?.slug || 'general' }

export default function FavoritesPage() {
  const [bookmarks, setBookmarks] = useState<DocRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bookmarks').then(r=>r.json()).then(d=>{setBookmarks(d.bookmarks||[])}).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-neutral-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="我的收藏" backTo="/internal/dashboard" backLabel="返回首页" />
      <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111] mb-1 flex items-center gap-2"><Star size={22} strokeWidth={1.5} className="text-amber-400 fill-amber-400" />我的收藏</h1>
      <p className="text-[0.85rem] text-neutral-500 mb-8">{bookmarks.length} 项收藏</p>
      {bookmarks.length > 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          {bookmarks.map((d,i)=>(
            <Link key={d.id} href={`/internal/docs/${slug(d)}/${encodeURIComponent(d.slug)}`}
              className={`flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 transition-colors no-underline ${i>0?'border-t border-neutral-100':''}`}>
              <div className="min-w-0"><p className="text-[0.88rem] text-[#111] truncate">{d.title}</p><p className="text-[0.72rem] text-neutral-400 mt-1">{d.department||d.ownerDept?.name||''} · {d.category||''}</p></div>
            </Link>
          ))}
        </div>
      ) : <div className="text-center py-20"><p className="text-[0.9rem] text-neutral-400">还没有收藏，浏览文档时点击星标即可收藏</p></div>}
    </div>
  )
}
