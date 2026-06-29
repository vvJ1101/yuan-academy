'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  DashboardHeader, SearchBar, CategoryChips,
  TaskCenter, ForYouFeed,
} from '@/components/internal/dashboard'
import type { StatsData, UserInfo } from '@/types/dashboard'

interface BrandInfo {
  name: string; slug: string; description: string; image: string
  spaces: string[]; focus: string
}

const BRANDS: BrandInfo[] = [
  {
    name: '时胜', slug: 'shisheng', description: '深圳时胜商贸发展有限公司',
    image: '/images/showroom/showroom-01.png',
    spaces: ['品牌运营', '订货管理', '展厅管理', 'Showroom SOP'],
    focus: '集团主体 \xb7 品牌运营与管理',
  },
  {
    name: '圜界', slug: 'huanjie', description: '圜界',
    image: '/images/showroom/showroom-02.webp',
    spaces: ['品牌资料', '运营规范'],
    focus: '品牌形象 \xb7 视觉传达与运营',
  },
  {
    name: '屹圆', slug: 'yiyuan', description: '屹圆',
    image: '/images/showroom/showroom-03.webp',
    spaces: ['产品知识', '销售政策'],
    focus: '产品体系 \xb7 商品知识与销售',
  },
  {
    name: '元睎', slug: 'yuanxi', description: '元睎',
    image: '/images/showroom/showroom-04.webp',
    spaces: ['品牌手册', '培训资料'],
    focus: '新人培训 \xb7 品牌文化与成长',
  },
]

export default function DashboardPage() {
  const [user, setUser] = useState<(UserInfo & { department?: string; company?: string }) | null>(null)
  const [stats, setStats] = useState<StatsData>({ totalDocs: 0, aiParsed: 0, recentlyViewed: 0, toLearn: 0 })
  const [activeCat, setActiveCat] = useState('all')
  const [loading, setLoading] = useState(true)
  const [recentDocs, setRecentDocs] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).catch(() => null),
      fetch('/api/dashboard').then(r => r.json()).catch(() => null),
    ]).then(([u, d]) => {
      if (u?.name) {
        setUser({
          ...u,
          department: u.departmentName || '',
          company: u.companyName || '',
        })
      }
      if (d) {
        if (d.recentDocs) setRecentDocs(d.recentDocs.slice(0, 5))
        setStats({
          totalDocs: d.docCount || d.totalDocs || 0,
          aiParsed: d.aiDocCount || d.aiParsed || 0,
          totalSpaces: d.companyCount || d.totalSpaces || 0,
          totalDepts: d.deptCount || d.totalDepts || 0,
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-10">

      {/* Header: greeting + stat cards + quick actions */}
      {user && (
        <DashboardHeader
          userName={user.name || '同事'}
          department={user.department || user.departmentName}
          company={user.company || user.companyName}
          stats={stats}
        />
      )}

      {/* Brand showcase */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[0.95rem] font-semibold text-neutral-800">集团品牌</h2>
          <Link href="/internal/documents" className="text-[0.72rem] text-neutral-400 hover:text-neutral-600 transition-colors no-underline flex items-center gap-0.5">
            查看全部 <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BRANDS.map((brand) => (
            <Link
              key={brand.slug}
              href={`/internal/documents?space=${brand.slug}`}
              className="group bg-white border border-neutral-100 rounded-xl overflow-hidden hover:shadow-md hover:border-neutral-200 transition-all no-underline"
            >
              <div className="aspect-[4/3] overflow-hidden bg-neutral-50">
                <img src={brand.image} alt={brand.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
              </div>
              <div className="p-3.5">
                <h3 className="text-[0.85rem] font-semibold text-neutral-800">{brand.name}</h3>
                <p className="text-[0.68rem] text-neutral-400 mt-0.5">{brand.focus}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {brand.spaces.slice(0, 2).map((s) => (
                    <span key={s} className="text-[0.6rem] px-1.5 py-0.5 bg-neutral-50 text-neutral-400 rounded">{s}</span>
                  ))}
                  {brand.spaces.length > 2 && (
                    <span className="text-[0.6rem] px-1.5 py-0.5 bg-neutral-50 text-neutral-300 rounded">+{brand.spaces.length - 2}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar />
      </div>

      {/* Category chips */}
      <div className="mb-8">
        <CategoryChips activeCat={activeCat} onCatChange={setActiveCat} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white border border-neutral-100 rounded-2xl p-5 md:p-6 shadow-sm">
            <TaskCenter />
          </div>
        </div>
        <div className="md:col-span-1">
          <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-sm">
            <ForYouFeed />
          </div>
        </div>
      </div>

      {/* Recent docs */}
      {recentDocs.length > 0 && (
        <div className="mt-8 bg-white border border-neutral-100 rounded-2xl p-5 md:p-6 shadow-sm">
          <h3 className="text-[0.95rem] font-semibold text-neutral-800 mb-4">最近更新</h3>
          <div className="space-y-2">
            {recentDocs.map((doc: any) => (
              <a key={doc.id} href={doc.slug ? `/internal/docs/${doc.audienceSlug || doc.ownerDept?.slug || 'general'}/${encodeURIComponent(doc.slug)}` : '#'}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-50 transition-colors no-underline">
                <span className="text-[0.85rem] text-neutral-700 truncate">{doc.title}</span>
                <span className="text-[0.68rem] text-neutral-400 shrink-0 ml-2">{doc.category}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
