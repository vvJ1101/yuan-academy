'use client'

type ContactItem = Record<string, string | undefined>

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <p className="text-[0.74rem] leading-relaxed">
      <span className="font-medium text-neutral-900">{label}：</span>
      <span className="text-neutral-700 whitespace-pre-line">{value}</span>
    </p>
  )
}

export function ContactCard({ item, view }: { item: ContactItem; view: 'market' | 'full' }) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
      <div>
        <h3 className="text-[0.95rem] font-semibold text-neutral-900">{item.brandName || '未命名品牌'}</h3>
        <p className="text-[0.7rem] text-neutral-500">
          {item.merchandisingOwner || '—'} / {item.brandOperationOwner || '—'} · {item.country || '—'} · {item.category || '—'}
        </p>
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
