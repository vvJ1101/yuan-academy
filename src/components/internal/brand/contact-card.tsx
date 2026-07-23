'use client'

import { useState } from 'react'
import { Edit3, Save, X } from 'lucide-react'
import { CONTACT_FIELD_LABELS } from '@/lib/brand-data-fields'
import type { BrandContactRecord } from '@/types/brand-data'

type ContactItem = Record<string, string | undefined>
type ContactField = keyof BrandContactRecord

const EDIT_SECTIONS: { title: string; tone: string; fields: ContactField[] }[] = [
  {
    title: '基础信息',
    tone: 'bg-neutral-50',
    fields: ['brandName', 'merchandisingOwner', 'brandOperationOwner', 'country', 'category'],
  },
  {
    title: '对接信息',
    tone: 'bg-neutral-50',
    fields: ['designer', 'contactPerson', 'phone', 'orderEmail', 'ccEmail'],
  },
  {
    title: '付款 / 开票',
    tone: 'bg-amber-50/60',
    fields: ['publicPaymentInfo', 'privatePaymentInfo', 'alipayInfo', 'invoiceInfo', 'privatePaymentMethod'],
  },
  {
    title: '合作信息',
    tone: 'bg-blue-50/60',
    fields: ['cooperationDiscount', 'taxIncluded', 'specialInvoice', 'normalInvoice', 'cooperationTime'],
  },
  {
    title: '仓库 / 发货',
    tone: 'bg-emerald-50/60',
    fields: ['afterSalesAddress', 'sampleAddress', 'weekendShippingTime'],
  },
]

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <p className="text-[0.74rem] leading-relaxed">
      <span className="font-medium text-neutral-900">{label}：</span>
      <span className="text-neutral-700 whitespace-pre-line">{value}</span>
    </p>
  )
}

function toDraft(item: ContactItem): BrandContactRecord {
  const draft: Partial<BrandContactRecord> = {}
  for (const key of Object.keys(CONTACT_FIELD_LABELS) as ContactField[]) {
    draft[key] = item[key] || ''
  }
  return draft as BrandContactRecord
}

export function ContactCard({
  item,
  view,
  onUpdated,
  canEdit = false,
}: {
  item: ContactItem
  view: 'market' | 'full'
  onUpdated?: () => void
  canEdit?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BrandContactRecord>(() => toDraft(item))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function updateField(field: ContactField, value: string) {
    setDraft(current => ({ ...current, [field]: value }))
    setMessage('')
  }

  async function save() {
    if (!draft.brandName.trim()) {
      setMessage('品牌名称不能为空')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/brand-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          originalBrandName: item.brandName || '',
          record: draft,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data.error || '保存失败')
        return
      }
      setEditing(false)
      setMessage('已保存')
      onUpdated?.()
    } catch {
      setMessage('网络错误，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <article className="rounded-xl border border-[#2563EB] bg-white p-4 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[0.95rem] font-semibold text-neutral-900">编辑品牌对接信息</h3>
            <p className="text-[0.7rem] text-neutral-500">小改动可直接保存，不需要重新上传 Excel。</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { setDraft(toDraft(item)); setEditing(false); setMessage('') }} className="min-h-[40px] min-w-[40px] rounded-lg text-neutral-400 hover:bg-neutral-100">
              <X size={15} className="mx-auto" />
            </button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-[0.75rem] text-white hover:bg-blue-600 disabled:opacity-50">
              <Save size={14} /> {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {EDIT_SECTIONS.map(section => (
          <section key={section.title} className={`rounded-lg ${section.tone} p-3`}>
            <p className="text-[0.72rem] font-semibold text-neutral-800 mb-2">{section.title}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {section.fields.map(field => {
                const long = ['publicPaymentInfo', 'privatePaymentInfo', 'alipayInfo', 'invoiceInfo', 'afterSalesAddress', 'sampleAddress', 'weekendShippingTime'].includes(field)
                return (
                  <label key={field} className={long ? 'md:col-span-2' : ''}>
                    <span className="block text-[0.65rem] text-neutral-500 mb-1">{CONTACT_FIELD_LABELS[field]}</span>
                    {long ? (
                      <textarea value={draft[field]} onChange={event => updateField(field, event.target.value)} rows={3} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[0.78rem] focus:outline-none focus:border-[#2563EB]" />
                    ) : (
                      <input value={draft[field]} onChange={event => updateField(field, event.target.value)} className="w-full min-h-[40px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[0.78rem] focus:outline-none focus:border-[#2563EB]" />
                    )}
                  </label>
                )
              })}
            </div>
          </section>
        ))}

        {message && (
          <p className={`text-[0.78rem] ${message === '已保存' ? 'text-emerald-600' : 'text-red-600'}`}>{message}</p>
        )}
      </article>
    )
  }

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.95rem] font-semibold text-neutral-900">{item.brandName || '未命名品牌'}</h3>
          <p className="text-[0.7rem] text-neutral-500">
            {item.merchandisingOwner || '—'} / {item.brandOperationOwner || '—'} · {item.country || '—'} · {item.category || '—'}
          </p>
        </div>
        {view === 'full' && canEdit && (
          <button type="button" onClick={() => { setDraft(toDraft(item)); setEditing(true); setMessage('') }} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-[0.72rem] text-neutral-500 hover:bg-blue-50 hover:text-[#2563EB]">
            <Edit3 size={13} /> 编辑
          </button>
        )}
      </div>

      {view === 'full' && (
        <section className="rounded-lg bg-neutral-50 p-3 space-y-1">
          <p className="text-[0.72rem] font-semibold text-neutral-800">对接信息</p>
          <Line label="主理人" value={item.designer} />
          <Line label="商品对接人" value={item.contactPerson} />
          <Line label="电话" value={item.phone} />
          <Line label="订单邮箱" value={item.orderEmail} />
          <Line label="抄送邮箱" value={item.ccEmail} />
        </section>
      )}

      {view === 'full' && (
        <section className="rounded-lg bg-amber-50/60 p-3 space-y-1">
          <p className="text-[0.72rem] font-semibold text-neutral-800">付款 / 开票</p>
          <Line label="付款对公信息" value={item.publicPaymentInfo} />
          <Line label="付款对私信息" value={item.privatePaymentInfo} />
          <Line label="支付宝信息" value={item.alipayInfo} />
          <Line label="开票信息" value={item.invoiceInfo} />
          <Line label="对私" value={item.privatePaymentMethod} />
        </section>
      )}

      <section className="rounded-lg bg-blue-50/60 p-3 space-y-1">
        <p className="text-[0.72rem] font-semibold text-[#2563EB]">合作信息</p>
        <Line label="合作折扣" value={item.cooperationDiscount} />
        <Line label="是否含票" value={item.taxIncluded} />
        <Line label="专票" value={item.specialInvoice} />
        <Line label="普票" value={item.normalInvoice} />
        <Line label="合作时间" value={item.cooperationTime} />
      </section>

      <section className="rounded-lg bg-emerald-50/60 p-3 space-y-1">
        <p className="text-[0.72rem] font-semibold text-emerald-700">仓库 / 发货</p>
        <Line label="售后地址" value={item.afterSalesAddress} />
        <Line label="样衣地址" value={item.sampleAddress} />
        <Line label="周末发货时间" value={item.weekendShippingTime} />
      </section>
    </article>
  )
}
