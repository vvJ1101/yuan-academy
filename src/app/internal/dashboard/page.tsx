'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, FileText, ScrollText, Building2, Users,
  ArrowRight, Clock, BookOpen, Settings, LayoutDashboard,
  ChevronRight, FileUp
} from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'
import CompanyProfileModal from '@/components/internal/company-profile-modal'

// ── Static mock data ──

const STATS = [
  { value: 22, label: '知识文档', desc: '集团文档总量', icon: FileText, color: '#2563EB' },
  { value: 14, label: '品牌政策', desc: '订货政策与规范', icon: ScrollText, color: '#059669' },
  { value: 4, label: '知识空间', desc: '品牌独立空间', icon: Building2, color: '#D97706' },
  { value: 7, label: '覆盖部门', desc: '跨部门协作', icon: Users, color: '#7C3AED' },
]

const BRANDS = [
  {
    name: '时胜公司', slug: 'shisheng',
    desc: 'YUANSHOWROOM · 集团主体与品牌运营管理',
    image: '/images/showroom/showroom-01.png',
    tags: ['品牌运营', '集团管理'],
    fullDesc: '时胜公司是集团核心运营主体，负责品牌战略规划与资源整合，驱动多品牌协同发展。',
    highlights: ['集团战略与运营管理中心', '品牌资源整合与协同发展', '跨部门协作与业务支持', ],
  },  {
    name: '圜界公司', slug: 'huanjie',
    desc: '时装周 · 时尚趋势与品牌形象策划',
    image: '/images/showroom/showroom-02.webp',
    tags: ['时装周', '品牌策划'],
    fullDesc: '专注时装周策划与时尚品牌形象塑造，搭建时尚产业上下游资源对接平台。',
    highlights: ['时装周活动策划与执行', '品牌视觉形象设计与传播', '时尚产业资源整合', ],
  },  {
    name: '屹圆公司', slug: 'yiyuan',
    desc: '电商运营 · 线上渠道与商品管理',
    image: '/images/showroom/showroom-03.webp',
    tags: ['电商运营', '渠道管理'],
    fullDesc: '聚焦线上电商渠道运营与商品全生命周期管理，打造高效的数字零售体系。',
    highlights: ['多平台电商渠道运营', '商品供应链与库存管理', '数据驱动的精准营销策略', ],
  },  {
    name: '元晞公司', slug: 'yuanxi',
    desc: '招商拓展 · 市场开发与合作伙伴管理',
    image: '/images/showroom/showroom-04.webp',
    tags: ['招商拓展', '市场开发'],
    fullDesc: '负责集团市场拓展与招商工作，建立广泛的合作伙伴网络，推动业务持续增长。',
    highlights: ['市场拓展与渠道开发', '招商策略与合作伙伴管理', '业务增长与品牌影响力建设', ],
  },  {
    name: '凹凸凸文化传媒公司', slug: 'aotutu',
    desc: 'MCN运营 · 新媒体内容与达人孵化',
    image: '/images/showroom/showroom-01.png',
    tags: ['MCN运营', '内容创作'],
    fullDesc: '新媒体内容创作与达人孵化平台，聚焦时尚与生活方式领域。',
    highlights: ['头部达人孵化与运营', '短视频内容策划与制作', '全平台新媒体矩阵运营'],
  },
]

interface Brand {
  name: string; slug: string; desc: string; image: string; tags: string[]
  fullDesc: string; highlights: string[]
}

const RECENT_UPDATES = [
  { title: '销售提成方案', tag: '政策', time: '刚刚更新', tagColor: 'bg-rose-50 text-rose-600' },
  { title: '时尚趋势分析 - 2026', tag: '综合', time: '今天 10:30', tagColor: 'bg-sky-50 text-sky-600' },
  { title: '元皓品牌文化手册', tag: '品牌', time: '昨天', tagColor: 'bg-violet-50 text-violet-600' },
  { title: '销售技巧培训', tag: '培训', time: '2天前', tagColor: 'bg-amber-50 text-amber-600' },
  { title: '门店运营SOP', tag: '流程', time: '3天前', tagColor: 'bg-emerald-50 text-emerald-600' },
]

const QUICK_ENTRIES = [
  { label: '订货政策', icon: ScrollText, slug: '/internal/policy' },
  { label: '政策上传', icon: FileUp, slug: '/internal/policy-upload' },
  { label: '品牌资料', icon: BookOpen, slug: '/internal/documents' },
  { label: '权限管理', icon: Settings, slug: '/internal/admin/role-permissions' },
]

const RECOMMENDED = [
  { title: '新人必读：元皓品牌文化', desc: '了解品牌历史与文化价值观' },
  { title: '订货政策使用指南', desc: '快速掌握订货政策查询与编辑' },
  { title: '门店运营SOP重点', desc: '日常运营标准操作流程汇总' },
]

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function DashboardPage() {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [userName, setUserName] = useState('同事')
  const [searchQuery, setSearchQuery] = useState('')
  const now = new Date()
  const h = now.getHours()
  const greeting = h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY[now.getDay()]}`

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(u => {
      if (u?.name) setUserName(u.name)
    }).catch((err: any) => console.warn("[SilentError]", err))
  }, [])

  function handleSearch() {
    if (!searchQuery.trim()) return
    window.location.href = `/internal/search?q=${encodeURIComponent(searchQuery)}`
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F6F7F9' }}>
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-8 space-y-6">

        {/* ── Welcome + Search Card ── */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-neutral-100">
          <div className="mb-1">
            <h1 className="text-[1.5rem] md:text-[1.8rem] font-light tracking-[-0.02em] text-neutral-900">
              {greeting}，{userName}
            </h1>
            <p className="text-[0.78rem] text-neutral-400 mt-1">
              {dateStr} · 深圳（香港）时胜集团
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-100">
            <h2 className="text-[0.95rem] font-semibold text-neutral-800">你想找什么资料？</h2>
            <p className="text-[0.78rem] text-neutral-400 mt-1 mb-4">
              支持搜索制度、流程、订货政策，也可以直接输入问题。
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-300" strokeWidth={1.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="元皓品牌订货政策 / 门店运营SOP / 销售技巧"
                  className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-[0.85rem] focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-5 py-2.5 bg-neutral-900 text-white text-[0.82rem] font-medium rounded-xl hover:bg-neutral-800 transition-colors shrink-0"
              >
                开始搜索
              </button>
            </div>
          </div>
        </div>

        {/* ── Data Overview Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: s.color + '12' }}
                >
                  <s.icon size={15} strokeWidth={1.5} style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-[1.5rem] font-semibold tracking-[-0.02em] text-neutral-900">{s.value}</p>
              <p className="text-[0.78rem] font-medium text-neutral-700 mt-0.5">{s.label}</p>
              <p className="text-[0.65rem] text-neutral-400 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Brand Module ── */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[0.92rem] font-semibold text-neutral-800">集团机构</h2>
            <Link
              href="/internal/documents"
              className="text-[0.7rem] text-neutral-400 hover:text-neutral-600 transition-colors no-underline flex items-center gap-0.5"
            >
              查看全部 <ArrowRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {BRANDS.map(b => (
              <button
                key={b.slug}
                onClick={() => setSelectedBrand(b)}
                className="group flex flex-col bg-white border border-neutral-100 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all no-underline text-left cursor-pointer"
              >
                <div className="aspect-[4/3] overflow-hidden bg-neutral-50">
                  <img
                    src={b.image}
                    alt={b.name}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                </div>
                <div className="flex flex-col flex-1 p-3.5">
                  <h3 className="text-[0.88rem] font-semibold text-neutral-800">{b.name}</h3>
                  <p className="flex-1 text-[0.65rem] text-neutral-400 mt-0.5 leading-relaxed">{b.desc}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {b.tags.map(t => (
                      <span
                        key={t}
                        className={`text-[0.58rem] px-1.5 py-0.5 rounded ${
                          t.startsWith('+') ? 'bg-neutral-50 text-neutral-300' : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Bottom Section: Recent + Quick + Recommend ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Recent Updates - left 2/3 */}
          <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[0.92rem] font-semibold text-neutral-800 flex items-center gap-1.5">
                <Clock size={15} strokeWidth={1.5} className="text-neutral-400" />
                最近更新
              </h2>
            </div>
            <div className="space-y-1">
              {RECENT_UPDATES.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-neutral-50 transition-colors cursor-default"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                    <span className="text-[0.82rem] text-neutral-700 truncate">{doc.title}</span>
                    <span className={`text-[0.6rem] px-1.5 py-0.5 rounded font-medium shrink-0 ${doc.tagColor}`}>
                      {doc.tag}
                    </span>
                  </div>
                  <span className="text-[0.68rem] text-neutral-400 shrink-0 ml-2">{doc.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick + Recommend - right 1/3 */}
          <div className="space-y-4">

            {/* Quick Entries */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
              <h2 className="text-[0.92rem] font-semibold text-neutral-800 mb-3 flex items-center gap-1.5">
                <LayoutDashboard size={15} strokeWidth={1.5} className="text-neutral-400" />
                常用入口
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ENTRIES.map(e => (
                  <Link
                    key={e.label}
                    href={e.slug}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 transition-all no-underline group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                      <e.icon size={14} strokeWidth={1.5} className="text-neutral-500" />
                    </div>
                    <span className="text-[0.75rem] font-medium text-neutral-700">{e.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recommended Reading */}
            <div className="bg-white rounded-2xl p-5 border border-neutral-100 shadow-sm">
              <h2 className="text-[0.92rem] font-semibold text-neutral-800 mb-3 flex items-center gap-1.5">
                <BookOpen size={15} strokeWidth={1.5} className="text-neutral-400" />
                推荐阅读
              </h2>
              <div className="space-y-2">
                {RECOMMENDED.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-neutral-50 transition-colors cursor-default"
                  >
                    <ChevronRight size={12} className="text-neutral-300 mt-0.5 shrink-0" strokeWidth={2} />
                    <div>
                      <p className="text-[0.78rem] font-medium text-neutral-700 leading-snug">{item.title}</p>
                      <p className="text-[0.65rem] text-neutral-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>

      {selectedBrand && (
        <CompanyProfileModal
          brand={selectedBrand}
          onClose={() => setSelectedBrand(null)}
        />
      )}
    </div>
  )
}
