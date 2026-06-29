'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'
import Link from 'next/link'

interface Path { id: string; title: string; deptId: string; docIds: string; docCount: number; docs: { id: string; title: string; slug: string; department?: string }[] }

export default function LearningPathsPage() {
  const [paths, setPaths] = useState<Path[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [docIds, setDocIds] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/learning-paths')
      .then(r => r.json())
      .then(d => { if (d?.data) setPaths(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!title) return
    setSaving(true)
    const ids = docIds.split(',').map(s => s.trim()).filter(Boolean)
    await fetch('/api/learning-paths', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, docIds: ids }),
    })
    setTitle(''); setDocIds(''); setSaving(false)
    window.location.reload()
  }

  const remove = async (id: string) => {
    if (!confirm('确定删除？')) return
    await fetch(`/api/learning-paths?id=${id}`, { method: 'DELETE' })
    setPaths(p => p.filter(x => x.id !== id))
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#2563EB]" /></div>

  return (
    <div className="max-w-[800px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <PageHeader title="学习路径" backTo="/internal/admin" backLabel="返回管理中心" />
      <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-neutral-900 mb-6"><GraduationCap size={22} strokeWidth={1.5} className="text-[#2563EB] inline mr-2" />学习路径管理</h1>

      {/* Create form */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-8">
        <h3 className="text-[0.8rem] font-medium text-neutral-700 mb-4">创建学习路径</h3>
        <div className="space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="路径名称" className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-neutral-900" />
          <input value={docIds} onChange={e => setDocIds(e.target.value)} placeholder="文档 ID（逗号分隔）" className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-neutral-900" />
          <button onClick={create} disabled={saving || !title} className="px-4 py-2 bg-neutral-900 text-white text-[0.82rem] rounded-lg hover:bg-neutral-800 disabled:opacity-50">{saving ? '创建中...' : '创建'}</button>
        </div>
      </div>

      {/* List */}
      {paths.length > 0 ? (
        <div className="space-y-4">
          {paths.map(p => (
            <div key={p.id} className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[0.9rem] font-semibold text-neutral-800">{p.title}</h3>
                <button onClick={() => remove(p.id)} className="text-[0.72rem] text-red-500 hover:text-red-700">删除</button>
              </div>
              <p className="text-[0.72rem] text-neutral-400 mb-3">{p.docCount} 篇文档</p>
              {p.docs?.length > 0 && (
                <div className="space-y-1">
                  {p.docs.map((d: any, i: number) => (
                    <Link key={d.id} href={`/internal/docs/${d.audiences?.[0]?.department?.slug || 'general'}/${encodeURIComponent(d.slug)}`}
                      className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-md hover:bg-neutral-50 transition-colors no-underline">
                      <span className="text-[0.7rem] text-neutral-400">{i + 1}.</span>
                      <span className="text-[0.82rem] text-neutral-700 truncate">{d.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[0.85rem] text-neutral-400">暂无学习路径</div>
      )}
    </div>
  )
}
