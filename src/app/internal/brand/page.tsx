'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { BrandTabs } from '@/components/internal/brand/brand-tabs'
import { ContactCard } from '@/components/internal/brand/contact-card'
import { UploadDialog } from '@/components/internal/brand/upload-dialog'
import { PageHeader } from '@/components/internal/page-header'

type ContactItem = Record<string, string | undefined>

interface ContactResponse {
  items: ContactItem[]
  view: 'market' | 'full'
  canEdit?: boolean
  canUpload?: boolean
  updatedAt: string
  updatedBy: string
  error?: string
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function can(permissions: string[], key: string) {
  return permissions.includes('*') || permissions.includes(key)
}

export default function BrandPage() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type') === 'ordering' ? 'ordering' : 'contact'
  const [items, setItems] = useState<ContactItem[]>([])
  const [view, setView] = useState<'market' | 'full'>('market')
  const [canEdit, setCanEdit] = useState(false)
  const [canUpload, setCanUpload] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')
  const [updatedBy, setUpdatedBy] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])

  const canExportMarket = can(permissions, 'brandContact.exportMarketFields')
  const canExportFull = can(permissions, 'brandContact.exportFullFields')
  const canExport = view === 'full' ? canExportFull : canExportMarket || canExportFull

  async function loadContactData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/brand-data?type=contact', { credentials: 'include' })
      const data = await response.json().catch(() => ({})) as ContactResponse
      if (!response.ok) {
        setError(data.error || '品牌对接信息加载失败')
        setItems([])
        return
      }
      setItems(Array.isArray(data.items) ? data.items : [])
      setView(data.view || 'market')
      setCanEdit(Boolean(data.canEdit))
      setCanUpload(Boolean(data.canUpload))
      setUpdatedAt(data.updatedAt || '')
      setUpdatedBy(data.updatedBy || '')
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(data => { if (Array.isArray(data?.permissions)) setPermissions(data.permissions) })
      .catch((err: any) => console.warn('[SilentError]', err))
    if (type === 'contact') loadContactData()
    else setLoading(false)
  }, [type])

  const countries = useMemo(() => Array.from(new Set(items.map(item => item.country || '').filter(Boolean))).sort(), [items])
  const categories = useMemo(() => Array.from(new Set(items.map(item => item.category || '').filter(Boolean))).sort(), [items])
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return items.filter(item => {
      if (countryFilter && item.country !== countryFilter) return false
      if (categoryFilter && item.category !== categoryFilter) return false
      if (!keyword) return true
      return [item.brandName, item.country, item.category, item.merchandisingOwner, item.brandOperationOwner]
        .some(value => (value || '').toLowerCase().includes(keyword))
    })
  }, [categoryFilter, countryFilter, items, search])

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-5xl w-full overflow-x-hidden">
      <PageHeader title="品牌资料" backTo="/internal/dashboard" backLabel="返回首页" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[1.35rem] font-semibold text-neutral-900 mb-1">品牌资料</h1>
          <p className="text-[0.82rem] text-neutral-500">
            统一查看订货政策与品牌对接信息
            {type === 'contact' && updatedAt ? ` · 更新于 ${fmtTime(updatedAt)}${updatedBy ? ` 由 ${updatedBy}` : ''}` : ''}
          </p>
        </div>
        <BrandTabs active={type} />
      </div>

      {type === 'ordering' ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-[1rem] font-semibold text-neutral-900 mb-2">订货政策</h2>
          <p className="text-[0.82rem] text-neutral-500 mb-4">
            订货政策暂时沿用现有页面，下一步会合并到此品牌资料页。
          </p>
          <Link href="/internal/policy" className="inline-flex min-h-[44px] items-center px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[0.82rem] no-underline hover:bg-blue-600">
            进入订货政策
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="搜索品牌、国家、类目或负责人..."
                className="flex-1 min-h-[44px] px-3 py-2 text-[0.85rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
              <div className="flex items-center gap-2 flex-wrap">
                {canExport && (
                  <a
                    href="/api/brand-data/export?type=contact"
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 bg-white text-[0.78rem] text-neutral-700 no-underline hover:bg-neutral-50"
                  >
                    <Download size={14} /> 导出
                  </a>
                )}
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563EB] text-[0.78rem] text-white hover:bg-blue-600"
                  >
                    <Upload size={14} /> 上传更新
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCountryFilter('')} className={`min-h-[40px] px-2.5 py-1 text-[0.7rem] rounded-md border ${!countryFilter ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}>全部国家</button>
              {countries.map(country => (
                <button key={country} onClick={() => setCountryFilter(countryFilter === country ? '' : country)} className={`min-h-[40px] px-2.5 py-1 text-[0.7rem] rounded-md border ${countryFilter === country ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}>{country}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCategoryFilter('')} className={`min-h-[40px] px-2.5 py-1 text-[0.7rem] rounded-md border ${!categoryFilter ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}>全部类目</button>
              {categories.map(category => (
                <button key={category} onClick={() => setCategoryFilter(categoryFilter === category ? '' : category)} className={`min-h-[40px] px-2.5 py-1 text-[0.7rem] rounded-md border ${categoryFilter === category ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'}`}>{category}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-neutral-400">加载中...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-[0.82rem] text-red-700">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center text-neutral-400">暂无匹配的品牌对接信息</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((item, index) => (
                <ContactCard
                  key={`${item.brandName || 'brand'}-${index}`}
                  item={item}
                  view={view}
                  canEdit={canEdit}
                  onUpdated={canEdit ? loadContactData : undefined}
                />
              ))}
            </div>
          )}

          <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={loadContactData} />
        </>
      )}
    </div>
  )
}
